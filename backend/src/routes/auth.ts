import { FastifyInstance } from "fastify";
import db from "../db/client";
import { User } from "../types";
import { verifyPassword, hashPassword, createSession, deleteSession } from "../auth/session";
import { requireAuth } from "../auth/middleware";

// In-memory rate limiter: 5 failures per IP within 15 minutes triggers lockout
const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const entry = failedAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) { failedAttempts.delete(ip); return false; }
  return entry.count >= RATE_LIMIT_MAX;
}
function recordFailure(ip: string): void {
  const entry = failedAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    failedAttempts.set(ip, { count: 1, resetAt: Date.now() + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count++;
  }
}
function clearFailures(ip: string): void {
  failedAttempts.delete(ip);
}

const isSecure = process.env.HTTPS_ONLY === "true";
const COOKIE_OPTS = `HttpOnly; Path=/; SameSite=Strict; Max-Age=604800${isSecure ? "; Secure" : ""}`;

export async function authRoutes(app: FastifyInstance) {
  // Login
  app.post("/api/auth/login", async (req, reply) => {
    const ip = req.ip;

    if (isRateLimited(ip)) {
      app.log.warn({ ip, event: "rate_limited" }, "Login rate limit exceeded");
      return reply.status(429).send({ error: "Too many failed attempts. Try again later." });
    }

    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return reply.status(400).send({ error: "Username and password required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as User | undefined;
    if (!user || !verifyPassword(password, user.password_hash)) {
      recordFailure(ip);
      app.log.warn({ ip, username, event: "login_failed" }, "Failed login attempt");
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    if (user.disabled) {
      app.log.warn({ ip, username, event: "login_disabled" }, "Disabled account login attempt");
      return reply.status(403).send({ error: "Account is disabled" });
    }

    clearFailures(ip);
    db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(Date.now(), user.id);
    const token = createSession(user.id); // also invalidates any prior sessions for this user
    app.log.info({ ip, username: user.username, role: user.role, event: "login_success" }, "User logged in");
    reply.header("Set-Cookie", `tracelab_session=${token}; ${COOKIE_OPTS}`);
    return { id: user.id, username: user.username, role: user.role, must_change_password: user.must_change_password === 1 };
  });

  // Logout
  app.post("/api/auth/logout", { preHandler: requireAuth }, async (req, reply) => {
    const cookieHeader = req.headers.cookie ?? "";
    const pair = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith("tracelab_session="));
    if (pair) {
      deleteSession(pair.slice("tracelab_session=".length));
    }
    app.log.info({ username: req.user?.username, event: "logout" }, "User logged out");
    reply.header("Set-Cookie", `tracelab_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`);
    return { ok: true };
  });

  // Current user
  app.get("/api/auth/me", { preHandler: requireAuth }, async (req) => {
    return req.user;
  });

  // Change password (requires current session)
  app.post("/api/auth/change-password", { preHandler: requireAuth }, async (req, reply) => {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) {
      return reply.status(400).send({ error: "Current and new password required" });
    }
    if (newPassword.length < 8) {
      return reply.status(400).send({ error: "New password must be at least 8 characters" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as User | undefined;
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      return reply.status(401).send({ error: "Current password is incorrect" });
    }

    const now = Date.now();
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?")
      .run(hashPassword(newPassword), now, req.user!.id);

    // Re-issue session to invalidate the old one
    const token = createSession(req.user!.id);
    reply.header("Set-Cookie", `tracelab_session=${token}; ${COOKIE_OPTS}`);
    app.log.info({ username: req.user!.username, event: "password_changed" }, "User changed password");
    return { ok: true };
  });
}

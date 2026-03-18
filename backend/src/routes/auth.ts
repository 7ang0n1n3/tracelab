import { FastifyInstance } from "fastify";
import db from "../db/client";
import { User } from "../types";
import { verifyPassword, createSession, deleteSession } from "../auth/session";
import { requireAuth } from "../auth/middleware";

const COOKIE_OPTS = "HttpOnly; Path=/; SameSite=Lax; Max-Age=604800";

export async function authRoutes(app: FastifyInstance) {
  // Login
  app.post("/api/auth/login", async (req, reply) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return reply.status(400).send({ error: "Username and password required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as User | undefined;
    if (!user || !verifyPassword(password, user.password_hash)) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const sessionId = createSession(user.id);
    reply.header("Set-Cookie", `tracelab_session=${sessionId}; ${COOKIE_OPTS}`);
    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  });

  // Logout
  app.post("/api/auth/logout", { preHandler: requireAuth }, async (req, reply) => {
    const cookieHeader = req.headers.cookie ?? "";
    const pair = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith("tracelab_session="));
    if (pair) {
      const sessionId = pair.slice("tracelab_session=".length);
      deleteSession(sessionId);
    }
    reply.header("Set-Cookie", "tracelab_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
    return { ok: true };
  });

  // Current user
  app.get("/api/auth/me", { preHandler: requireAuth }, async (req) => {
    return req.user;
  });
}

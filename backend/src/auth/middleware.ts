import { FastifyRequest, FastifyReply } from "fastify";
import { getSessionUser } from "./session";
import { User } from "../types";

declare module "fastify" {
  interface FastifyRequest {
    user?: Omit<User, "password_hash">;
  }
}

function parseSessionCookie(req: FastifyRequest): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const pair = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith("tracelab_session="));
  return pair ? pair.slice("tracelab_session=".length) : undefined;
}

// Rate-limit invalid session token lookups to slow brute-force token enumeration
const badTokenAttempts = new Map<string, { count: number; resetAt: number }>();
const BAD_TOKEN_MAX = 30;
const BAD_TOKEN_WINDOW_MS = 15 * 60 * 1000;

function isBadTokenRateLimited(ip: string): boolean {
  const entry = badTokenAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) { badTokenAttempts.delete(ip); return false; }
  return entry.count >= BAD_TOKEN_MAX;
}
function recordBadToken(ip: string): void {
  const entry = badTokenAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    badTokenAttempts.set(ip, { count: 1, resetAt: Date.now() + BAD_TOKEN_WINDOW_MS });
  } else {
    entry.count++;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = parseSessionCookie(req);
  if (!token) {
    req.log.warn({ url: req.url, ip: req.ip, event: "auth_missing" }, "Request without session");
    return reply.status(401).send({ error: "Unauthorized" });
  }
  if (isBadTokenRateLimited(req.ip)) {
    return reply.status(429).send({ error: "Too many invalid session requests. Try again later." });
  }
  const user = getSessionUser(token);
  if (!user) {
    recordBadToken(req.ip);
    req.log.warn({ url: req.url, ip: req.ip, event: "session_invalid" }, "Invalid or expired session");
    return reply.status(401).send({ error: "Session expired" });
  }
  req.user = user;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (req.user?.role !== "admin") {
    req.log.warn({ url: req.url, ip: req.ip, username: req.user?.username, event: "admin_required" }, "Non-admin access attempt");
    return reply.status(403).send({ error: "Admin access required" });
  }
}

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

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessionId = parseSessionCookie(req);
  if (!sessionId) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  const user = getSessionUser(sessionId);
  if (!user) {
    return reply.status(401).send({ error: "Session expired" });
  }
  req.user = user;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (req.user?.role !== "admin") {
    return reply.status(403).send({ error: "Admin access required" });
  }
}

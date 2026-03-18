import crypto from "crypto";
import db from "../db/client";
import { User, Session } from "../types";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

export function createSession(userId: string): string {
  const id = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  db.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(id, userId, now, now + SESSION_TTL_MS);
  return id;
}

export function getSessionUser(sessionId: string): Omit<User, "password_hash"> | null {
  const session = db.prepare(
    "SELECT * FROM sessions WHERE id = ? AND expires_at > ?"
  ).get(sessionId, Date.now()) as Session | undefined;

  if (!session) return null;

  const user = db.prepare(
    "SELECT id, username, role, created_at, updated_at FROM users WHERE id = ?"
  ).get(session.user_id) as Omit<User, "password_hash"> | undefined;

  return user ?? null;
}

export function deleteSession(sessionId: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

// Purge expired sessions (call periodically)
export function purgeExpiredSessions(): void {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
}

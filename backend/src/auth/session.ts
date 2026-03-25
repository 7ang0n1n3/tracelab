import crypto from "crypto";
import db from "../db/client";
import { User, Session } from "../types";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Lazily loaded HMAC secret (stored in settings on first boot by initSchema)
let _secret: string | null = null;
function getSecret(): string {
  if (_secret) return _secret;
  const row = db.prepare("SELECT value FROM settings WHERE key = 'session_secret'").get() as { value: string } | undefined;
  if (!row?.value) throw new Error("Session secret missing — ensure initSchema() has been called before handling requests");
  _secret = row.value;
  return _secret;
}

// Hash raw token before storing — DB compromise alone is not enough to forge sessions
function hashToken(token: string): string {
  return crypto.createHmac("sha256", getSecret()).update(token).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  // Always run pbkdf2 regardless of hash format to prevent timing oracle
  const salt = parts[0] ?? "0000000000000000";
  const expectedHex = parts[1] ?? "0".repeat(128);
  const candidate = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  try {
    const match = crypto.timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(candidate, "hex"));
    return match && parts.length === 2;
  } catch {
    return false; // buffer length mismatch from malformed stored hash
  }
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const now = Date.now();
  // Invalidate all existing sessions for this user (prevents session fixation)
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  db.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(tokenHash, userId, now, now + SESSION_TTL_MS);
  return token; // Raw token sent to client — hash stored in DB
}

export function getSessionUser(token: string): Omit<User, "password_hash"> | null {
  const tokenHash = hashToken(token);
  const session = db.prepare(
    "SELECT * FROM sessions WHERE id = ? AND expires_at > ?"
  ).get(tokenHash, Date.now()) as Session | undefined;

  if (!session) return null;

  const user = db.prepare(
    "SELECT id, username, role, disabled, must_change_password, last_login, created_at, updated_at FROM users WHERE id = ?"
  ).get(session.user_id) as Omit<User, "password_hash"> | undefined;

  if (!user || user.disabled) return null;
  return user;
}

// Returns the session expiry timestamp (ms) for a valid token, or null if not found / expired.
// Used by SSE streams to close at exactly the right time without re-querying on every tick.
export function getSessionExpiry(token: string): number | null {
  const tokenHash = hashToken(token);
  const session = db.prepare(
    "SELECT expires_at FROM sessions WHERE id = ? AND expires_at > ?"
  ).get(tokenHash, Date.now()) as Pick<Session, "expires_at"> | undefined;
  return session?.expires_at ?? null;
}

export function deleteSession(token: string): void {
  const tokenHash = hashToken(token);
  db.prepare("DELETE FROM sessions WHERE id = ?").run(tokenHash);
}

export function purgeExpiredSessions(): void {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
}

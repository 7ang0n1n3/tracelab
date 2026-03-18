import crypto from "crypto";
import db from "./client";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'qa',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tests (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      app_name TEXT,
      base_url TEXT,
      script TEXT NOT NULL DEFAULT '',
      tags TEXT,
      auth_state_id TEXT,
      use_auth INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at INTEGER,
      finished_at INTEGER,
      duration_ms INTEGER,
      exit_code INTEGER,
      log TEXT,
      artifact_path TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_states (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      app_name TEXT,
      base_url TEXT,
      file_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migrate existing tables (no-op if columns already exist)
  try { db.exec("ALTER TABLE tests ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL"); } catch {}
  try { db.exec("ALTER TABLE auth_states ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL"); } catch {}

  // Default settings
  const defaults: Record<string, string> = {
    headless: "true",
    slowMo: "0",
    timeout: "30000",
    captureScreenshots: "true",
    captureVideo: "false",
    captureTrace: "false",
  };
  const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries(defaults)) {
    insertSetting.run(key, value);
  }

  // Seed default admin user
  const existing = db.prepare("SELECT id FROM users WHERE username = 'sysadmin'").get();
  if (!existing) {
    const now = Date.now();
    db.prepare(
      "INSERT INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      crypto.randomUUID(),
      "sysadmin",
      hashPassword("qazxsw"),
      "admin",
      now,
      now
    );
    console.log("[TraceLab] Default admin user created: sysadmin / qazxsw");
  }
}

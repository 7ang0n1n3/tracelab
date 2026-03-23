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
  try { db.exec("ALTER TABLE tests ADD COLUMN browser TEXT"); } catch {}
  try { db.exec("ALTER TABLE tests ADD COLUMN capture_video INTEGER"); } catch {}

  try { db.exec("ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN last_login INTEGER"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE runs ADD COLUMN vnc_port INTEGER"); } catch {}
  try { db.exec("ALTER TABLE tests ADD COLUMN headless INTEGER"); } catch {}
  try { db.exec("ALTER TABLE tests ADD COLUMN retry_count INTEGER"); } catch {}
  try { db.exec("ALTER TABLE runs ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE runs ADD COLUMN parent_run_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE runs ADD COLUMN chain_run_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE runs ADD COLUMN triggered_by_run_id TEXT"); } catch {}

  // Chain links table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chain_links (
      id TEXT PRIMARY KEY,
      from_test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      to_test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      continue_on_failure INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(from_test_id, to_test_id)
    );
  `);

  // Test shares table
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_shares (
      id TEXT PRIMARY KEY,
      test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      grantee_type TEXT NOT NULL,
      grantee_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(test_id, grantee_type, grantee_id)
    );
  `);

  // Default settings
  const defaults: Record<string, string> = {
    headless: "true",
    slowMo: "0",
    timeout: "30000",
    captureScreenshots: "true",
    captureVideo: "false",
    captureTrace: "false",
    defaultBrowser: "chromium",
    retryCount: "0",
  };
  const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries(defaults)) {
    insertSetting.run(key, value);
  }

  // Generate persistent HMAC secret for session token hashing
  const secretExists = db.prepare("SELECT 1 FROM settings WHERE key = 'session_secret'").get();
  if (!secretExists) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
      "session_secret",
      crypto.randomBytes(32).toString("hex")
    );
  }

  // Seed default admin user
  const existing = db.prepare("SELECT id FROM users WHERE username = 'sysadmin'").get();
  if (!existing) {
    const now = Date.now();
    const adminId = crypto.randomUUID();
    db.prepare(
      "INSERT INTO users (id, username, password_hash, role, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      adminId,
      "sysadmin",
      hashPassword("qazxsw"),
      "admin",
      1, // force password change on first login
      now,
      now
    );
    console.log("[TraceLab] Default admin user created: sysadmin (password change required on first login)");

    // Seed sample test owned by the admin
    db.prepare(
      "INSERT INTO tests (id, user_id, name, description, app_name, base_url, script, tags, use_auth, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      crypto.randomUUID(),
      adminId,
      "TraceLab — smoke test",
      "Sample test: verifies the runner can launch a browser, navigate to tangonine.com and the TraceLab GitHub repo, and capture screenshots. Run this after a fresh install to confirm the setup is working correctly.",
      "TraceLab",
      "https://www.tangonine.com",
      `// Sample TraceLab test — smoke test
// Run this to verify your Playwright runner is set up correctly.

await page.goto('https://www.tangonine.com');
log('Navigated to tangonine.com');
await takeScreenshot('tangonine-home');

await page.waitForTimeout(3000);

await page.goto('https://github.com/7ang0n1n3/tracelab');
log('Navigated to TraceLab GitHub repo');
await takeScreenshot('tracelab-github');

log('Smoke test complete — runner is working correctly');
`,
      JSON.stringify(["sample", "smoke"]),
      0,
      now,
      now
    );
    console.log("[TraceLab] Sample test created: TraceLab — smoke test");
  }
}

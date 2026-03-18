import { FastifyInstance } from "fastify";
import db from "../db/client";
import { requireAuth, requireAdmin } from "../auth/middleware";

// Only expose and allow writes to these keys — prevents tampering with session_secret or other internals
const ALLOWED_KEYS = new Set(["headless", "slowMo", "timeout", "captureScreenshots", "captureVideo", "captureTrace"]);

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/settings", { preHandler: requireAuth }, async () => {
    const rows = db.prepare("SELECT key, value FROM settings WHERE key != 'session_secret'").all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });

  app.put("/api/settings", { preHandler: requireAdmin }, async (req, reply) => {
    const body = req.body as Record<string, string>;
    const update = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    db.exec("BEGIN");
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.has(key)) continue;
      update.run(key, String(value));
    }
    db.exec("COMMIT");
    const rows = db.prepare("SELECT key, value FROM settings WHERE key != 'session_secret'").all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });
}

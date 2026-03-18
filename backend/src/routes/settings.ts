import { FastifyInstance } from "fastify";
import db from "../db/client";
import { requireAuth } from "../auth/middleware";

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/settings", { preHandler: requireAuth }, async () => {
    const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });

  app.put("/api/settings", { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as Record<string, string>;
    const update = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    db.exec("BEGIN");
    for (const [key, value] of Object.entries(body)) {
      update.run(key, String(value));
    }
    db.exec("COMMIT");
    const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });
}

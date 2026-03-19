import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { Test } from "../types";
import { dispatchRun } from "../runner/executor";
import { requireAuth } from "../auth/middleware";

export async function testsRoutes(app: FastifyInstance) {
  // List tests
  app.get("/api/tests", { preHandler: requireAuth }, async (req) => {
    const { app: appFilter, tag, search } = req.query as Record<string, string>;
    const isAdmin = req.user!.role === "admin";

    let query = "SELECT * FROM tests";
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (!isAdmin) {
      conditions.push("(user_id = ? OR user_id IS NULL)");
      params.push(req.user!.id);
    }
    if (appFilter) {
      conditions.push("app_name = ?");
      params.push(appFilter);
    }
    if (search) {
      const safe = search.slice(0, 200).replace(/[\\%_]/g, "\\$&");
      conditions.push("(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
      params.push(`%${safe}%`, `%${safe}%`);
    }
    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY updated_at DESC";

    const tests = db.prepare(query).all(...params) as unknown as Test[];

    if (tag) {
      return tests.filter((t) => {
        try {
          return JSON.parse(t.tags || "[]").includes(tag);
        } catch {
          return false;
        }
      });
    }
    return tests;
  });

  // Get one test
  app.get("/api/tests/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(id) as Test | undefined;
    if (!test) return reply.status(404).send({ error: "Not found" });
    if (req.user!.role !== "admin" && test.user_id && test.user_id !== req.user!.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    return test;
  });

  // Create test
  app.post("/api/tests", { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as Partial<Test>;
    const now = Date.now();
    const id = uuidv4();
    const validBrowsers = ["chromium", "firefox", "webkit"];
    const browser = validBrowsers.includes(body.browser as string) ? body.browser : null;
    const captureVideo = body.capture_video != null ? (body.capture_video ? 1 : 0) : null;
    db.prepare(`
      INSERT INTO tests (id, user_id, name, description, app_name, base_url, script, tags, auth_state_id, use_auth, browser, capture_video, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user!.id,
      body.name ?? "Untitled Test",
      body.description ?? null,
      body.app_name ?? null,
      body.base_url ?? null,
      body.script ?? "",
      body.tags ?? null,
      body.auth_state_id ?? null,
      body.use_auth ?? 1,
      browser ?? null,
      captureVideo,
      now,
      now
    );
    return reply.status(201).send(db.prepare("SELECT * FROM tests WHERE id = ?").get(id));
  });

  // Update test
  app.put("/api/tests/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<Test>;
    const existing = db.prepare("SELECT * FROM tests WHERE id = ?").get(id) as Test | undefined;
    if (!existing) return reply.status(404).send({ error: "Not found" });
    if (req.user!.role !== "admin" && existing.user_id && existing.user_id !== req.user!.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const validBrowsers = ["chromium", "firefox", "webkit"];
    const browser = "browser" in body
      ? (validBrowsers.includes(body.browser as string) ? body.browser : null)
      : existing.browser;
    const captureVideo = "capture_video" in body
      ? (body.capture_video != null ? (body.capture_video ? 1 : 0) : null)
      : existing.capture_video;
    db.prepare(`
      UPDATE tests SET
        name = ?, description = ?, app_name = ?, base_url = ?,
        script = ?, tags = ?, auth_state_id = ?, use_auth = ?, browser = ?, capture_video = ?, updated_at = ?
      WHERE id = ?
    `).run(
      body.name ?? existing.name,
      body.description ?? existing.description,
      body.app_name ?? existing.app_name,
      body.base_url ?? existing.base_url,
      body.script ?? existing.script,
      body.tags ?? existing.tags,
      body.auth_state_id ?? existing.auth_state_id,
      body.use_auth ?? existing.use_auth,
      browser ?? null,
      captureVideo ?? null,
      Date.now(),
      id
    );
    return db.prepare("SELECT * FROM tests WHERE id = ?").get(id);
  });

  // Delete test
  app.delete("/api/tests/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = db.prepare("SELECT * FROM tests WHERE id = ?").get(id) as Test | undefined;
    if (!existing) return reply.status(404).send({ error: "Not found" });
    if (req.user!.role !== "admin" && existing.user_id && existing.user_id !== req.user!.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    db.prepare("DELETE FROM tests WHERE id = ?").run(id);
    return reply.status(204).send();
  });

  // Duplicate test
  app.post("/api/tests/:id/duplicate", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const original = db.prepare("SELECT * FROM tests WHERE id = ?").get(id) as Test | undefined;
    if (!original) return reply.status(404).send({ error: "Not found" });
    if (req.user!.role !== "admin" && original.user_id && original.user_id !== req.user!.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const now = Date.now();
    const newId = uuidv4();
    db.prepare(`
      INSERT INTO tests (id, user_id, name, description, app_name, base_url, script, tags, auth_state_id, use_auth, browser, capture_video, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      req.user!.id,
      `${original.name} (copy)`,
      original.description,
      original.app_name,
      original.base_url,
      original.script,
      original.tags,
      original.auth_state_id,
      original.use_auth,
      original.browser ?? null,
      original.capture_video ?? null,
      now,
      now
    );
    return reply.status(201).send(db.prepare("SELECT * FROM tests WHERE id = ?").get(newId));
  });

  // Trigger a run
  app.post("/api/tests/:id/run", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(id) as Test | undefined;
    if (!test) return reply.status(404).send({ error: "Not found" });
    if (req.user!.role !== "admin" && test.user_id && test.user_id !== req.user!.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const runId = uuidv4();
    const now = Date.now();
    db.prepare("INSERT INTO runs (id, test_id, status, created_at) VALUES (?, ?, 'pending', ?)").run(runId, id, now);
    dispatchRun(runId, test).catch((err) => console.error("Run dispatch error:", err));
    return reply.status(202).send({ runId });
  });
}

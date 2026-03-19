import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { Test } from "../types";
import { dispatchRun } from "../runner/executor";
import { requireAuth } from "../auth/middleware";

const VALID_BROWSERS = ["chromium", "firefox", "webkit"];

type AccessLevel = "admin" | "owner" | "write" | "read";

function getTestAccess(test: Test, userId: string, userRole: string): AccessLevel | null {
  if (userRole === "admin") return "admin";
  if (!test.user_id || test.user_id === userId) return "owner";
  const share = db.prepare(`
    SELECT permission FROM test_shares
    WHERE test_id = ? AND (
      (grantee_type = 'user' AND grantee_id = ?) OR
      (grantee_type = 'role' AND grantee_id = ?)
    )
    ORDER BY CASE permission WHEN 'write' THEN 0 ELSE 1 END
    LIMIT 1
  `).get(test.id, userId, userRole) as { permission: string } | undefined;
  if (share) return share.permission as "read" | "write";
  return null;
}

export async function testsRoutes(app: FastifyInstance) {
  // List tests
  app.get("/api/tests", { preHandler: requireAuth }, async (req) => {
    const { app: appFilter, tag, search } = req.query as Record<string, string>;
    const isAdmin = req.user!.role === "admin";

    let query = "SELECT * FROM tests";
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (!isAdmin) {
      conditions.push(`(user_id = ? OR user_id IS NULL OR EXISTS (
        SELECT 1 FROM test_shares ts WHERE ts.test_id = tests.id AND (
          (ts.grantee_type = 'user' AND ts.grantee_id = ?) OR
          (ts.grantee_type = 'role' AND ts.grantee_id = ?)
        )
      ))`);
      params.push(req.user!.id, req.user!.id, req.user!.role);
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
    const access = getTestAccess(test, req.user!.id, req.user!.role);
    if (!access) return reply.status(403).send({ error: "Forbidden" });
    return { ...test, _access: access };
  });

  // Create test
  app.post("/api/tests", { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as Partial<Test>;
    const now = Date.now();
    const id = uuidv4();
    const browser = VALID_BROWSERS.includes(body.browser as string) ? body.browser : null;
    const captureVideo = body.capture_video != null ? (body.capture_video ? 1 : 0) : null;
    const headless = body.headless != null ? (body.headless ? 1 : 0) : null;
    db.prepare(`
      INSERT INTO tests (id, user_id, name, description, app_name, base_url, script, tags, auth_state_id, use_auth, browser, capture_video, headless, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      headless,
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
    const access = getTestAccess(existing, req.user!.id, req.user!.role);
    if (!access) return reply.status(403).send({ error: "Forbidden" });
    if (access === "read") return reply.status(403).send({ error: "Read-only access" });

    const browser = "browser" in body
      ? (VALID_BROWSERS.includes(body.browser as string) ? body.browser : null)
      : existing.browser;
    const captureVideo = "capture_video" in body
      ? (body.capture_video != null ? (body.capture_video ? 1 : 0) : null)
      : existing.capture_video;
    const headless = "headless" in body
      ? (body.headless != null ? (body.headless ? 1 : 0) : null)
      : existing.headless;
    db.prepare(`
      UPDATE tests SET
        name = ?, description = ?, app_name = ?, base_url = ?,
        script = ?, tags = ?, auth_state_id = ?, use_auth = ?, browser = ?, capture_video = ?, headless = ?, updated_at = ?
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
      headless ?? null,
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
    const access = getTestAccess(existing, req.user!.id, req.user!.role);
    if (!access || access === "read") return reply.status(403).send({ error: "Forbidden" });
    // Only owner/admin can delete
    if (access !== "owner" && access !== "admin") return reply.status(403).send({ error: "Forbidden" });
    db.prepare("DELETE FROM tests WHERE id = ?").run(id);
    return reply.status(204).send();
  });

  // Duplicate test
  app.post("/api/tests/:id/duplicate", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const original = db.prepare("SELECT * FROM tests WHERE id = ?").get(id) as Test | undefined;
    if (!original) return reply.status(404).send({ error: "Not found" });
    const access = getTestAccess(original, req.user!.id, req.user!.role);
    if (!access) return reply.status(403).send({ error: "Forbidden" });

    const now = Date.now();
    const newId = uuidv4();
    db.prepare(`
      INSERT INTO tests (id, user_id, name, description, app_name, base_url, script, tags, auth_state_id, use_auth, browser, capture_video, headless, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      original.headless ?? null,
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
    const access = getTestAccess(test, req.user!.id, req.user!.role);
    if (!access) return reply.status(403).send({ error: "Forbidden" });

    const runId = uuidv4();
    const now = Date.now();
    db.prepare("INSERT INTO runs (id, test_id, status, created_at) VALUES (?, ?, 'pending', ?)").run(runId, id, now);
    dispatchRun(runId, test).catch((err) => console.error("Run dispatch error:", err));
    return reply.status(202).send({ runId });
  });
}

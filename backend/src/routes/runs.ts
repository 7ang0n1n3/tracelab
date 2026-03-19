import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import db from "../db/client";
import { Run, Test } from "../types";
import { requireAuth } from "../auth/middleware";

const ARTIFACTS_PATH = process.env.ARTIFACTS_PATH || "./data/artifacts";

function canAccessTest(userId: string, userRole: string, testId: string): boolean {
  if (userRole === "admin") return true;
  const test = db.prepare("SELECT user_id FROM tests WHERE id = ?").get(testId) as Pick<Test, "user_id"> | undefined;
  if (!test) return false;
  if (!test.user_id || test.user_id === userId) return true;
  const share = db.prepare(`
    SELECT 1 FROM test_shares
    WHERE test_id = ? AND (
      (grantee_type = 'user' AND grantee_id = ?) OR
      (grantee_type = 'role' AND grantee_id = ?)
    )
  `).get(testId, userId, userRole);
  return !!share;
}

export async function runsRoutes(app: FastifyInstance) {
  // List runs
  app.get("/api/runs", { preHandler: requireAuth }, async (req) => {
    const { test_id, status, limit = "50" } = req.query as Record<string, string>;
    const isAdmin = req.user!.role === "admin";

    let query: string;
    const params: (string | number)[] = [];

    if (isAdmin) {
      query = "SELECT runs.* FROM runs";
      const conditions: string[] = [];
      if (test_id) { conditions.push("test_id = ?"); params.push(test_id); }
      if (status) { conditions.push("status = ?"); params.push(status); }
      if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    } else {
      query = `SELECT runs.* FROM runs INNER JOIN tests ON runs.test_id = tests.id
        WHERE (tests.user_id = ? OR tests.user_id IS NULL OR EXISTS (
          SELECT 1 FROM test_shares ts WHERE ts.test_id = tests.id AND (
            (ts.grantee_type = 'user' AND ts.grantee_id = ?) OR
            (ts.grantee_type = 'role' AND ts.grantee_id = ?)
          )
        ))`;
      params.push(req.user!.id, req.user!.id, req.user!.role);
      if (test_id) { query += " AND runs.test_id = ?"; params.push(test_id); }
      if (status) { query += " AND runs.status = ?"; params.push(status); }
    }
    query += " ORDER BY runs.created_at DESC LIMIT ?";
    params.push(parseInt(limit, 10));

    return db.prepare(query).all(...params) as unknown as Run[];
  });

  // Get single run
  app.get("/api/runs/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Run | undefined;
    if (!run) return reply.status(404).send({ error: "Not found" });
    if (!canAccessTest(req.user!.id, req.user!.role, run.test_id)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const artifactDir = path.join(ARTIFACTS_PATH, id);
    let screenshots: string[] = [];
    if (fs.existsSync(artifactDir)) {
      screenshots = fs
        .readdirSync(artifactDir)
        .filter((f) => f.endsWith(".png") || f.endsWith(".jpg"))
        .map((f) => `/api/artifacts/${id}/file/${f}`);
    }

    return { ...run, screenshots };
  });

  // Live log stream via SSE
  app.get("/api/runs/:id/logs", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Run | undefined;
    if (!run) return reply.status(404).send({ error: "Not found" });
    if (!canAccessTest(req.user!.id, req.user!.role, run.test_id)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");

    const send = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`);
    };

    const interval = setInterval(() => {
      const current = db
        .prepare("SELECT status, log FROM runs WHERE id = ?")
        .get(id) as Pick<Run, "status" | "log"> | undefined;

      if (!current) {
        clearInterval(interval);
        reply.raw.end();
        return;
      }

      if (current.log) send(current.log);

      if (["passed", "failed", "error"].includes(current.status)) {
        reply.raw.write("data: __done__\n\n");
        clearInterval(interval);
        reply.raw.end();
      }
    }, 1000);

    req.raw.on("close", () => clearInterval(interval));
  });

  // Delete run
  app.delete("/api/runs/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Run | undefined;
    if (!run) return reply.status(404).send({ error: "Not found" });
    if (!canAccessTest(req.user!.id, req.user!.role, run.test_id)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const artifactDir = path.join(ARTIFACTS_PATH, id);
    if (fs.existsSync(artifactDir)) {
      fs.rmSync(artifactDir, { recursive: true });
    }
    db.prepare("DELETE FROM runs WHERE id = ?").run(id);
    return reply.status(204).send();
  });
}

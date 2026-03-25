// /backend/src/routes/schedules.ts
import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { Schedule, Test } from "../types";
import { requireAuth } from "../auth/middleware";
import { computeNextRun, validateCron } from "../scheduler/index";

type AccessLevel = "admin" | "owner" | "write" | "read";

function getTestAccess(test: Test, userId: string, userRole: string): AccessLevel | null {
  if (userRole === "admin") return "admin";
  if (test.user_id === userId) return "owner";
  if (!test.user_id) return null;
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

function scheduleWithTestAccess(sched: Schedule, userId: string, userRole: string): AccessLevel | null {
  const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(sched.test_id) as Test | undefined;
  if (!test) return userRole === "admin" ? "admin" : null;
  return getTestAccess(test, userId, userRole);
}

export async function schedulesRoutes(app: FastifyInstance) {
  // List schedules (all the user can access, with optional test_id filter)
  app.get("/api/schedules", { preHandler: requireAuth }, async (req) => {
    const { test_id } = req.query as Record<string, string>;
    const isAdmin = req.user!.role === "admin";

    let query = `
      SELECT s.*, t.name as test_name FROM schedules s
      JOIN tests t ON t.id = s.test_id
    `;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (!isAdmin) {
      conditions.push(`(t.user_id = ? OR EXISTS (
        SELECT 1 FROM test_shares ts WHERE ts.test_id = t.id AND (
          (ts.grantee_type = 'user' AND ts.grantee_id = ?) OR
          (ts.grantee_type = 'role' AND ts.grantee_id = ?)
        )
      ))`);
      params.push(req.user!.id, req.user!.id, req.user!.role);
    }

    if (test_id) {
      conditions.push("s.test_id = ?");
      params.push(test_id);
    }

    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY s.created_at DESC";

    return db.prepare(query).all(...params);
  });

  // Get one schedule
  app.get("/api/schedules/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sched = db.prepare(`
      SELECT s.*, t.name as test_name FROM schedules s
      JOIN tests t ON t.id = s.test_id
      WHERE s.id = ?
    `).get(id) as (Schedule & { test_name: string }) | undefined;
    if (!sched) return reply.status(404).send({ error: "Not found" });
    const access = scheduleWithTestAccess(sched, req.user!.id, req.user!.role);
    if (!access) return reply.status(403).send({ error: "Forbidden" });
    return sched;
  });

  // Create schedule
  app.post("/api/schedules", { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as { test_id?: string; cron_expr?: string; label?: string };
    if (!body.test_id || !body.cron_expr) {
      return reply.status(400).send({ error: "test_id and cron_expr are required" });
    }

    const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(body.test_id) as Test | undefined;
    if (!test) return reply.status(404).send({ error: "Test not found" });

    const access = getTestAccess(test, req.user!.id, req.user!.role);
    if (!access || access === "read") return reply.status(403).send({ error: "Forbidden" });

    if (!validateCron(body.cron_expr)) {
      return reply.status(400).send({ error: "Invalid cron expression" });
    }

    const nextDate = computeNextRun(body.cron_expr);
    const id = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO schedules (id, test_id, label, cron_expr, enabled, next_run_at, created_at, created_by)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      id,
      body.test_id,
      body.label?.trim() || null,
      body.cron_expr.trim(),
      nextDate ? nextDate.getTime() : null,
      now,
      req.user!.id
    );

    return reply.status(201).send(db.prepare(`
      SELECT s.*, t.name as test_name FROM schedules s
      JOIN tests t ON t.id = s.test_id WHERE s.id = ?
    `).get(id));
  });

  // Update schedule (cron_expr, label, enabled)
  app.patch("/api/schedules/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sched = db.prepare("SELECT * FROM schedules WHERE id = ?").get(id) as Schedule | undefined;
    if (!sched) return reply.status(404).send({ error: "Not found" });

    const access = scheduleWithTestAccess(sched, req.user!.id, req.user!.role);
    if (!access || access === "read") return reply.status(403).send({ error: "Forbidden" });

    const body = req.body as { cron_expr?: string; label?: string; enabled?: number };

    // Validate cron if provided
    const newCron = body.cron_expr?.trim() ?? sched.cron_expr;
    if (body.cron_expr !== undefined && !validateCron(newCron)) {
      return reply.status(400).send({ error: "Invalid cron expression" });
    }

    // Recompute next_run_at if cron changed or schedule re-enabled
    const newEnabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : sched.enabled;
    let nextRunAt = sched.next_run_at;
    if (body.cron_expr !== undefined || (newEnabled === 1 && sched.enabled === 0)) {
      const nextDate = computeNextRun(newCron);
      nextRunAt = nextDate ? nextDate.getTime() : null;
    }

    db.prepare(`
      UPDATE schedules SET cron_expr = ?, label = ?, enabled = ?, next_run_at = ? WHERE id = ?
    `).run(
      newCron,
      body.label !== undefined ? (body.label?.trim() || null) : sched.label,
      newEnabled,
      nextRunAt,
      id
    );

    return db.prepare(`
      SELECT s.*, t.name as test_name FROM schedules s
      JOIN tests t ON t.id = s.test_id WHERE s.id = ?
    `).get(id);
  });

  // Delete schedule
  app.delete("/api/schedules/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sched = db.prepare("SELECT * FROM schedules WHERE id = ?").get(id) as Schedule | undefined;
    if (!sched) return reply.status(404).send({ error: "Not found" });

    const access = scheduleWithTestAccess(sched, req.user!.id, req.user!.role);
    if (!access || access === "read") return reply.status(403).send({ error: "Forbidden" });

    db.prepare("DELETE FROM schedules WHERE id = ?").run(id);
    return reply.status(204).send();
  });
}

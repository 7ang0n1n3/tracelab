// /backend/src/routes/chain-links.ts
import { FastifyInstance } from "fastify";
import crypto from "crypto";
import db from "../db/client";
import { ChainLink, Test } from "../types";
import { requireAuth } from "../auth/middleware";

type AccessLevel = "admin" | "owner" | "write" | "read";

function getTestAccess(testId: string, userId: string, userRole: string): AccessLevel | null {
  if (userRole === "admin") return "admin";
  const test = db.prepare("SELECT user_id FROM tests WHERE id = ?").get(testId) as Pick<Test, "user_id"> | undefined;
  if (!test) return null;
  if (test.user_id === userId) return "owner";
  if (!test.user_id) return null;
  const share = db.prepare(`
    SELECT permission FROM test_shares
    WHERE test_id = ? AND (
      (grantee_type = 'user' AND grantee_id = ?) OR
      (grantee_type = 'role' AND grantee_id = ?)
    )
    ORDER BY CASE permission WHEN 'write' THEN 0 ELSE 1 END LIMIT 1
  `).get(testId, userId, userRole) as { permission: string } | undefined;
  if (share) return share.permission as "read" | "write";
  return null;
}

/** BFS: returns true if `target` is reachable from `start` following outgoing chain_links */
function canReach(start: string, target: string): boolean {
  const visited = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === target) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const nexts = db.prepare("SELECT to_test_id FROM chain_links WHERE from_test_id = ?").all(cur) as { to_test_id: string }[];
    for (const n of nexts) queue.push(n.to_test_id);
  }
  return false;
}

export async function chainLinksRoutes(app: FastifyInstance) {
  // GET /api/tests/:id/chain — outgoing + incoming links with test details
  app.get("/api/tests/:id/chain", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const access = getTestAccess(id, req.user!.id, req.user!.role);
    if (!access) return reply.status(403).send({ error: "Forbidden" });

    const outgoing = db.prepare(`
      SELECT cl.*, t.name AS to_test_name
      FROM chain_links cl
      JOIN tests t ON cl.to_test_id = t.id
      WHERE cl.from_test_id = ?
      ORDER BY cl.created_at ASC
    `).all(id) as unknown as (ChainLink & { to_test_name: string })[];

    const incoming = db.prepare(`
      SELECT cl.*, t.name AS from_test_name
      FROM chain_links cl
      JOIN tests t ON cl.from_test_id = t.id
      WHERE cl.to_test_id = ?
      ORDER BY cl.created_at ASC
    `).all(id) as unknown as (ChainLink & { from_test_name: string })[];

    return { outgoing, incoming };
  });

  // POST /api/chain-links — create a chain link
  app.post("/api/chain-links", { preHandler: requireAuth }, async (req, reply) => {
    const { from_test_id, to_test_id, continue_on_failure = 0 } = req.body as {
      from_test_id: string;
      to_test_id: string;
      continue_on_failure?: number;
    };

    if (!from_test_id || !to_test_id) {
      return reply.status(400).send({ error: "from_test_id and to_test_id are required" });
    }
    if (from_test_id === to_test_id) {
      return reply.status(400).send({ error: "A test cannot chain to itself" });
    }

    // Verify both tests exist and user has write access to from_test
    const fromAccess = getTestAccess(from_test_id, req.user!.id, req.user!.role);
    if (!fromAccess || fromAccess === "read") {
      return reply.status(403).send({ error: "Write access required on the source test" });
    }
    const toExists = db.prepare("SELECT id FROM tests WHERE id = ?").get(to_test_id);
    if (!toExists) return reply.status(404).send({ error: "Target test not found" });

    // Cycle detection: adding from→to is safe if to cannot already reach from
    if (canReach(to_test_id, from_test_id)) {
      return reply.status(409).send({ error: "This link would create a cycle in the chain" });
    }

    const id = crypto.randomUUID();
    try {
      db.prepare(
        "INSERT INTO chain_links (id, from_test_id, to_test_id, continue_on_failure, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(id, from_test_id, to_test_id, continue_on_failure ? 1 : 0, Date.now());
    } catch (err: any) {
      if (err.message?.includes("UNIQUE")) {
        return reply.status(409).send({ error: "This chain link already exists" });
      }
      throw err;
    }

    return reply.status(201).send(db.prepare("SELECT * FROM chain_links WHERE id = ?").get(id));
  });

  // PATCH /api/chain-links/:id — toggle continue_on_failure
  app.patch("/api/chain-links/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { continue_on_failure } = req.body as { continue_on_failure: number };
    const link = db.prepare("SELECT * FROM chain_links WHERE id = ?").get(id) as ChainLink | undefined;
    if (!link) return reply.status(404).send({ error: "Not found" });

    const access = getTestAccess(link.from_test_id, req.user!.id, req.user!.role);
    if (!access || access === "read") return reply.status(403).send({ error: "Forbidden" });

    db.prepare("UPDATE chain_links SET continue_on_failure = ? WHERE id = ?").run(
      continue_on_failure ? 1 : 0, id
    );
    return db.prepare("SELECT * FROM chain_links WHERE id = ?").get(id);
  });

  // DELETE /api/chain-links/:id
  app.delete("/api/chain-links/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const link = db.prepare("SELECT * FROM chain_links WHERE id = ?").get(id) as ChainLink | undefined;
    if (!link) return reply.status(404).send({ error: "Not found" });

    const access = getTestAccess(link.from_test_id, req.user!.id, req.user!.role);
    if (!access || access === "read") return reply.status(403).send({ error: "Forbidden" });

    db.prepare("DELETE FROM chain_links WHERE id = ?").run(id);
    return reply.status(204).send();
  });
}

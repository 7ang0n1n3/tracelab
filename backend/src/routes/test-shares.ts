import { FastifyInstance } from "fastify";
import crypto from "crypto";
import db from "../db/client";
import { Test, TestShare } from "../types";
import { requireAuth } from "../auth/middleware";

const VALID_GRANTEE_TYPES = ["user", "role"];
const VALID_PERMISSIONS = ["read", "write"];
const VALID_ROLES = ["admin", "dev", "qa"];

function isOwnerOrAdmin(test: Test, userId: string, userRole: string): boolean {
  if (userRole === "admin") return true;
  return !test.user_id || test.user_id === userId;
}

export async function testSharesRoutes(app: FastifyInstance) {
  // List shares for a test (owner/admin only)
  app.get("/api/tests/:id/shares", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(id) as Test | undefined;
    if (!test) return reply.status(404).send({ error: "Not found" });
    if (!isOwnerOrAdmin(test, req.user!.id, req.user!.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const shares = db.prepare(
      "SELECT * FROM test_shares WHERE test_id = ? ORDER BY created_at ASC"
    ).all(id) as unknown as TestShare[];

    // Enrich user shares with username
    const userIds = shares
      .filter((s) => s.grantee_type === "user")
      .map((s) => s.grantee_id);
    const usersById: Record<string, string> = {};
    if (userIds.length) {
      const placeholders = userIds.map(() => "?").join(",");
      const rows = db
        .prepare(`SELECT id, username FROM users WHERE id IN (${placeholders})`)
        .all(...userIds) as { id: string; username: string }[];
      for (const u of rows) usersById[u.id] = u.username;
    }

    return shares.map((s) => ({
      ...s,
      grantee_label: s.grantee_type === "user"
        ? (usersById[s.grantee_id] ?? s.grantee_id)
        : `role:${s.grantee_id}`,
    }));
  });

  // Add a share (owner/admin only)
  app.post("/api/tests/:id/shares", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { grantee_type, grantee_id, permission } = req.body as {
      grantee_type?: string;
      grantee_id?: string;
      permission?: string;
    };

    const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(id) as Test | undefined;
    if (!test) return reply.status(404).send({ error: "Not found" });
    if (!isOwnerOrAdmin(test, req.user!.id, req.user!.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    if (!grantee_type || !VALID_GRANTEE_TYPES.includes(grantee_type)) {
      return reply.status(400).send({ error: "Invalid grantee_type" });
    }
    if (!grantee_id) {
      return reply.status(400).send({ error: "grantee_id required" });
    }
    if (!permission || !VALID_PERMISSIONS.includes(permission)) {
      return reply.status(400).send({ error: "Invalid permission (read|write)" });
    }

    // Validate grantee exists
    if (grantee_type === "user") {
      const user = db.prepare("SELECT id FROM users WHERE id = ?").get(grantee_id);
      if (!user) return reply.status(404).send({ error: "User not found" });
      // Cannot share with yourself
      if (grantee_id === req.user!.id) {
        return reply.status(400).send({ error: "Cannot share with yourself" });
      }
    } else {
      if (!VALID_ROLES.includes(grantee_id)) {
        return reply.status(400).send({ error: "Invalid role" });
      }
    }

    const shareId = crypto.randomUUID();
    try {
      db.prepare(
        "INSERT INTO test_shares (id, test_id, grantee_type, grantee_id, permission, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(shareId, id, grantee_type, grantee_id, permission, Date.now());
    } catch {
      // UNIQUE constraint — update permission instead
      db.prepare(
        "UPDATE test_shares SET permission = ? WHERE test_id = ? AND grantee_type = ? AND grantee_id = ?"
      ).run(permission, id, grantee_type, grantee_id);
      const existing = db.prepare(
        "SELECT * FROM test_shares WHERE test_id = ? AND grantee_type = ? AND grantee_id = ?"
      ).get(id, grantee_type, grantee_id) as unknown as TestShare;
      return reply.status(200).send(existing);
    }

    return reply.status(201).send(
      db.prepare("SELECT * FROM test_shares WHERE id = ?").get(shareId)
    );
  });

  // Remove a share (owner/admin only)
  app.delete("/api/tests/:id/shares/:shareId", { preHandler: requireAuth }, async (req, reply) => {
    const { id, shareId } = req.params as { id: string; shareId: string };
    const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(id) as Test | undefined;
    if (!test) return reply.status(404).send({ error: "Not found" });
    if (!isOwnerOrAdmin(test, req.user!.id, req.user!.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const share = db.prepare("SELECT id FROM test_shares WHERE id = ? AND test_id = ?").get(shareId, id);
    if (!share) return reply.status(404).send({ error: "Share not found" });

    db.prepare("DELETE FROM test_shares WHERE id = ?").run(shareId);
    return reply.status(204).send();
  });
}

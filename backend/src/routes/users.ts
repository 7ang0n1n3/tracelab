import { FastifyInstance } from "fastify";
import crypto from "crypto";
import db from "../db/client";
import { User } from "../types";
import { hashPassword } from "../auth/session";
import { requireAdmin, requireAuth } from "../auth/middleware";

export async function usersRoutes(app: FastifyInstance) {
  // User directory — all authenticated users (for share picker)
  app.get("/api/users/directory", { preHandler: requireAuth }, async (req) => {
    return db
      .prepare("SELECT id, username, role FROM users ORDER BY username ASC")
      .all()
      .filter((u: any) => u.id !== req.user!.id);
  });

  // List all users (admin only)
  app.get("/api/users", { preHandler: requireAdmin }, async () => {
    return db
      .prepare("SELECT id, username, role, disabled, must_change_password, last_login, created_at, updated_at FROM users ORDER BY created_at ASC")
      .all() as Omit<User, "password_hash">[];
  });

  // Create user (admin only)
  app.post("/api/users", { preHandler: requireAdmin }, async (req, reply) => {
    const { username, password, role } = req.body as {
      username?: string;
      password?: string;
      role?: string;
    };
    if (!username || !password) {
      return reply.status(400).send({ error: "Username and password required" });
    }
    const validRoles = ["admin", "dev", "qa"];
    const userRole = validRoles.includes(role ?? "") ? role! : "qa";

    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (existing) {
      return reply.status(409).send({ error: "Username already taken" });
    }

    const now = Date.now();
    const id = crypto.randomUUID();
    db.prepare(
      "INSERT INTO users (id, username, password_hash, role, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, username, hashPassword(password), userRole, 1, now, now); // new users must change password on first login

    req.log.info({ actor: req.user!.username, target: username, role: userRole, event: "user_created" }, "Admin created user");
    return reply.status(201).send(
      db.prepare("SELECT id, username, role, disabled, must_change_password, last_login, created_at, updated_at FROM users WHERE id = ?").get(id)
    );
  });

  // Update user (admin only)
  app.put("/api/users/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { username, password, role, disabled } = req.body as {
      username?: string;
      password?: string;
      role?: string;
      disabled?: boolean;
    };

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
    if (!user) return reply.status(404).send({ error: "Not found" });

    // Cannot disable your own account
    if (disabled !== undefined && id === req.user!.id) {
      return reply.status(400).send({ error: "Cannot disable your own account" });
    }

    // Cannot disable the first (oldest) admin account
    if (disabled) {
      const firstAdmin = db.prepare(
        "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
      ).get() as { id: string } | undefined;
      if (firstAdmin?.id === id) {
        return reply.status(400).send({ error: "Cannot disable the primary admin account" });
      }
    }

    const validRoles = ["admin", "dev", "qa"];
    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (username && username !== user.username) {
      const taken = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, id);
      if (taken) return reply.status(409).send({ error: "Username already taken" });
      updates.push("username = ?");
      params.push(username);
    }
    if (password) {
      updates.push("password_hash = ?");
      params.push(hashPassword(password));
      // Admin resetting another user's password forces them to change it on next login
      if (id !== req.user!.id) {
        updates.push("must_change_password = 1");
      }
    }
    if (role && validRoles.includes(role)) {
      updates.push("role = ?");
      params.push(role);
    }
    if (disabled !== undefined) {
      updates.push("disabled = ?");
      params.push(disabled ? 1 : 0);
      // Kill all active sessions when disabling
      if (disabled) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    }
    if (!updates.length) return reply.status(400).send({ error: "Nothing to update" });

    updates.push("updated_at = ?");
    params.push(Date.now(), id);

    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    req.log.info({ actor: req.user!.username, target: user.username, fields: updates, event: "user_updated" }, "Admin updated user");
    return db.prepare("SELECT id, username, role, disabled, must_change_password, last_login, created_at, updated_at FROM users WHERE id = ?").get(id);
  });

  // Delete user (admin only, cannot delete self)
  app.delete("/api/users/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.user!.id) {
      return reply.status(400).send({ error: "Cannot delete your own account" });
    }
    const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(id) as { id: string; username: string } | undefined;
    if (!user) return reply.status(404).send({ error: "Not found" });
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    req.log.info({ actor: req.user!.username, target: user.username, event: "user_deleted" }, "Admin deleted user");
    return reply.status(204).send();
  });
}

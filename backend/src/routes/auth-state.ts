import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import db from "../db/client";
import { AuthState } from "../types";
import axios from "axios";
import { requireAuth } from "../auth/middleware";

const AUTH_STATE_PATH = process.env.AUTH_STATE_PATH || "./data/auth";
const RUNNER_URL = process.env.RUNNER_URL || "http://runner:5000";

function canAccess(userId: string, role: string, state: AuthState): boolean {
  if (role === "admin") return true;
  return !state.user_id || state.user_id === userId;
}

export async function authStateRoutes(app: FastifyInstance) {
  // List auth states
  app.get("/api/auth-states", { preHandler: requireAuth }, async (req) => {
    const isAdmin = req.user!.role === "admin";
    if (isAdmin) {
      return db
        .prepare("SELECT id, user_id, name, app_name, base_url, created_at, updated_at, last_used_at FROM auth_states ORDER BY updated_at DESC")
        .all() as Omit<AuthState, "file_path">[];
    }
    return db
      .prepare("SELECT id, user_id, name, app_name, base_url, created_at, updated_at, last_used_at FROM auth_states WHERE user_id = ? OR user_id IS NULL ORDER BY updated_at DESC")
      .all(req.user!.id) as Omit<AuthState, "file_path">[];
  });

  // Create new auth state record
  app.post("/api/auth-states", { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as Partial<AuthState>;
    const id = uuidv4();
    const now = Date.now();
    const filePath = path.join(AUTH_STATE_PATH, `${id}.json`);

    db.prepare(`
      INSERT INTO auth_states (id, user_id, name, app_name, base_url, file_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user!.id, body.name ?? "New Auth State", body.app_name ?? null, body.base_url ?? null, filePath, now, now);

    const record = db.prepare("SELECT id, user_id, name, app_name, base_url, created_at, updated_at, last_used_at FROM auth_states WHERE id = ?").get(id);
    return reply.status(201).send(record);
  });

  // Delete auth state
  app.delete("/api/auth-states/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const state = db.prepare("SELECT * FROM auth_states WHERE id = ?").get(id) as AuthState | undefined;
    if (!state) return reply.status(404).send({ error: "Not found" });
    if (!canAccess(req.user!.id, req.user!.role, state)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    if (fs.existsSync(state.file_path)) fs.unlinkSync(state.file_path);
    db.prepare("DELETE FROM auth_states WHERE id = ?").run(id);
    return reply.status(204).send();
  });

  // Launch browser to capture a new login session
  app.post("/api/auth-states/:id/record", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const state = db.prepare("SELECT * FROM auth_states WHERE id = ?").get(id) as AuthState | undefined;
    if (!state) return reply.status(404).send({ error: "Not found" });
    if (!canAccess(req.user!.id, req.user!.role, state)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    try {
      const response = await axios.post(`${RUNNER_URL}/record-auth`, {
        authStateId: id,
        outputPath: state.file_path,
        baseUrl: state.base_url,
      });
      return reply.send(response.data);
    } catch (err: any) {
      return reply.status(502).send({ error: "Runner unavailable", detail: err.message });
    }
  });

  // Refresh (re-capture) existing auth state
  app.post("/api/auth-states/:id/refresh", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const state = db.prepare("SELECT * FROM auth_states WHERE id = ?").get(id) as AuthState | undefined;
    if (!state) return reply.status(404).send({ error: "Not found" });
    if (!canAccess(req.user!.id, req.user!.role, state)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    if (fs.existsSync(state.file_path)) fs.unlinkSync(state.file_path);
    db.prepare("UPDATE auth_states SET updated_at = ? WHERE id = ?").run(Date.now(), id);

    try {
      const response = await axios.post(`${RUNNER_URL}/record-auth`, {
        authStateId: id,
        outputPath: state.file_path,
        baseUrl: state.base_url,
      });
      return reply.send(response.data);
    } catch (err: any) {
      return reply.status(502).send({ error: "Runner unavailable", detail: err.message });
    }
  });

  // Finish an active auth recording session
  app.post("/api/auth-states/:id/finish-record", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const state = db.prepare("SELECT * FROM auth_states WHERE id = ?").get(id) as AuthState | undefined;
    if (!state) return reply.status(404).send({ error: "Not found" });
    if (!canAccess(req.user!.id, req.user!.role, state)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    try {
      const response = await axios.post(`${RUNNER_URL}/record-auth/finish`, { authStateId: id });
      db.prepare("UPDATE auth_states SET updated_at = ? WHERE id = ?").run(Date.now(), id);
      return reply.send(response.data);
    } catch (err: any) {
      return reply.status(502).send({ error: err?.response?.data?.error ?? err.message });
    }
  });

  // Check if auth state file exists
  app.get("/api/auth-states/:id/status", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const state = db.prepare("SELECT * FROM auth_states WHERE id = ?").get(id) as AuthState | undefined;
    if (!state) return reply.status(404).send({ error: "Not found" });
    if (!canAccess(req.user!.id, req.user!.role, state)) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    return { id, hasFile: fs.existsSync(state.file_path), updatedAt: state.updated_at };
  });
}

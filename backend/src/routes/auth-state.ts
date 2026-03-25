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
const RUNNER_SECRET = process.env.RUNNER_SECRET || "";

function runnerHeaders(): Record<string, string> {
  return RUNNER_SECRET ? { Authorization: `Bearer ${RUNNER_SECRET}` } : {};
}

function canAccess(userId: string, role: string, state: AuthState): boolean {
  if (role === "admin") return true;
  return !state.user_id || state.user_id === userId;
}

// Always derive the filesystem path from the record ID — never trust the stored file_path column.
// This eliminates path traversal if the database is tampered with.
function safeFilePath(id: string): string {
  return path.join(path.resolve(AUTH_STATE_PATH), `${id}.json`);
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
    const filePath = safeFilePath(id);

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

    const filePath = safeFilePath(state.id);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
        outputPath: safeFilePath(state.id),
        baseUrl: state.base_url,
      }, { headers: runnerHeaders() });
      req.log.info({ auth_state_id: id, actor: req.user!.username, event: "auth_state_record_started" }, "Auth state recording started");
      return reply.send(response.data);
    } catch (err: any) {
      return reply.status(502).send({ error: "Runner unavailable" });
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
    const refreshPath = safeFilePath(state.id);
    if (fs.existsSync(refreshPath)) fs.unlinkSync(refreshPath);
    db.prepare("UPDATE auth_states SET updated_at = ? WHERE id = ?").run(Date.now(), id);

    try {
      const response = await axios.post(`${RUNNER_URL}/record-auth`, {
        authStateId: id,
        outputPath: refreshPath,
        baseUrl: state.base_url,
      }, { headers: runnerHeaders() });
      req.log.info({ auth_state_id: id, actor: req.user!.username, event: "auth_state_refresh_started" }, "Auth state refresh started");
      return reply.send(response.data);
    } catch (err: any) {
      return reply.status(502).send({ error: "Runner unavailable" });
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
      const response = await axios.post(`${RUNNER_URL}/record-auth/finish`, { authStateId: id }, { headers: runnerHeaders() });
      db.prepare("UPDATE auth_states SET updated_at = ? WHERE id = ?").run(Date.now(), id);
      return reply.send(response.data);
    } catch (err: any) {
      return reply.status(502).send({ error: err?.response?.data?.error ?? "Runner unavailable" });
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
    return { id, hasFile: fs.existsSync(safeFilePath(state.id)), updatedAt: state.updated_at };
  });
}

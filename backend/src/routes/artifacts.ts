import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import db from "../db/client";
import { requireAuth } from "../auth/middleware";
import { Run, Test } from "../types";

const ARTIFACTS_PATH = process.env.ARTIFACTS_PATH || "./data/artifacts";

function canAccessRun(userId: string, userRole: string, runId: string): boolean {
  if (userRole === "admin") return true;
  const run = db.prepare("SELECT test_id FROM runs WHERE id = ?").get(runId) as Pick<Run, "test_id"> | undefined;
  if (!run) return false;
  const test = db.prepare("SELECT user_id FROM tests WHERE id = ?").get(run.test_id) as Pick<Test, "user_id"> | undefined;
  if (!test) return false;
  if (!test.user_id || test.user_id === userId) return true;
  const share = db.prepare(`
    SELECT 1 FROM test_shares
    WHERE test_id = ? AND (
      (grantee_type = 'user' AND grantee_id = ?) OR
      (grantee_type = 'role' AND grantee_id = ?)
    )
  `).get(run.test_id, userId, userRole);
  return !!share;
}

export async function artifactsRoutes(app: FastifyInstance) {
  // List screenshots for a run
  app.get("/api/artifacts/:runId/screenshots", { preHandler: requireAuth }, async (req, reply) => {
    const { runId } = req.params as { runId: string };
    if (!canAccessRun(req.user!.id, req.user!.role, runId)) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    const dir = path.join(ARTIFACTS_PATH, runId);
    if (!fs.existsSync(dir)) return [];
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".png") || f.endsWith(".jpg"))
      .map((f) => ({
        name: f,
        url: `/api/artifacts/${runId}/file/${f}`,
        size: fs.statSync(path.join(dir, f)).size,
      }));
    return files;
  });

  // Serve a specific artifact file
  app.get("/api/artifacts/:runId/file/:name", { preHandler: requireAuth }, async (req, reply) => {
    const { runId, name } = req.params as { runId: string; name: string };
    if (!canAccessRun(req.user!.id, req.user!.role, runId)) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    const safeName = path.basename(name);
    const filePath = path.join(ARTIFACTS_PATH, runId, safeName);
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: "File not found" });
    }
    const ext = path.extname(safeName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".zip": "application/zip",
      ".html": "text/html",
    };
    reply.header("Content-Type", mimeTypes[ext] || "application/octet-stream");
    return reply.send(fs.createReadStream(filePath));
  });

  // List all artifact files for a run
  app.get("/api/artifacts/:runId", { preHandler: requireAuth }, async (req, reply) => {
    const { runId } = req.params as { runId: string };
    if (!canAccessRun(req.user!.id, req.user!.role, runId)) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    const dir = path.join(ARTIFACTS_PATH, runId);
    if (!fs.existsSync(dir)) return { files: [] };
    const files = fs.readdirSync(dir).map((f) => ({
      name: f,
      url: `/api/artifacts/${runId}/file/${f}`,
      size: fs.statSync(path.join(dir, f)).size,
    }));
    return { files };
  });
}

import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import os from "os";
import { spawnSync } from "child_process";
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
      ".txt": "text/plain",
      ".json": "application/json",
      ".js": "text/plain", // served as plain text to prevent execution
    };
    if (!mimeTypes[ext]) {
      return reply.status(403).send({ error: "File type not allowed" });
    }
    // Force download for non-image types to prevent in-browser execution
    const inlineTypes = new Set([".png", ".jpg", ".jpeg", ".mp4", ".webm"]);
    if (!inlineTypes.has(ext)) {
      reply.header("Content-Disposition", `attachment; filename="${safeName}"`);
    }
    reply.header("Content-Type", mimeTypes[ext]);
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

  // Export all artifacts + log as a ZIP
  app.get("/api/artifacts/:runId/export", { preHandler: requireAuth }, async (req, reply) => {
    const { runId } = req.params as { runId: string };
    if (!canAccessRun(req.user!.id, req.user!.role, runId)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as Run | undefined;
    if (!run) return reply.status(404).send({ error: "Run not found" });

    const test = db.prepare("SELECT name, script FROM tests WHERE id = ?").get(run.test_id) as Pick<Test, "name" | "script"> | undefined;
    const testName = test?.name ?? "unknown";
    const safeName = testName.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    const filename = `tracelab-${safeName}-${runId.slice(0, 8)}.zip`;

    const artifactDir = path.join(ARTIFACTS_PATH, runId);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tracelab-export-"));
    fs.chmodSync(tmpDir, 0o700); // restrict to owner — prevent other local users reading run artifacts
    const zipPath = path.join(tmpDir, "export.zip");

    try {
      // Write run metadata
      const info = {
        id: run.id,
        test_name: testName,
        status: run.status,
        started_at: run.started_at,
        finished_at: run.finished_at,
        duration_ms: run.duration_ms,
        error_message: run.error_message,
      };
      fs.writeFileSync(path.join(tmpDir, "run-info.json"), JSON.stringify(info, null, 2), "utf8");

      // Write log
      if (run.log) {
        fs.writeFileSync(path.join(tmpDir, "log.txt"), run.log, "utf8");
      }

      // Write test script
      if (test?.script) {
        fs.writeFileSync(path.join(tmpDir, "script.js"), test.script, "utf8");
      }

      // Zip artifacts directly from their directory (no copy)
      if (fs.existsSync(artifactDir) && fs.readdirSync(artifactDir).length > 0) {
        const result = spawnSync("/usr/bin/zip", ["-r", zipPath, "."], { cwd: artifactDir, timeout: 60000 });
        if (result.status !== 0) throw new Error(`zip artifacts failed: ${result.stderr?.toString()}`);
      }

      // Add metadata files to the zip (or create zip if no artifacts)
      const metaFiles = ["run-info.json", ...(run.log ? ["log.txt"] : []), ...(test?.script ? ["script.js"] : [])];
      const result = spawnSync("/usr/bin/zip", [zipPath, ...metaFiles], { cwd: tmpDir, timeout: 10000 });
      if (result.status !== 0) throw new Error(`zip metadata failed: ${result.stderr?.toString()}`);

      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);

      const cleanup = () => fs.rmSync(tmpDir, { recursive: true, force: true });
      const stream = fs.createReadStream(zipPath);
      stream.on("close", cleanup);
      stream.on("error", cleanup);
      return reply.send(stream);
    } catch (err) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      throw err;
    }
  });
}

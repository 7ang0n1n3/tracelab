import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import { requireAuth } from "../auth/middleware";

const ARTIFACTS_PATH = process.env.ARTIFACTS_PATH || "./data/artifacts";

export async function artifactsRoutes(app: FastifyInstance) {
  // List screenshots for a run
  app.get("/api/artifacts/:runId/screenshots", { preHandler: requireAuth }, async (req, reply) => {
    const { runId } = req.params as { runId: string };
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
    // Sanitize to prevent path traversal
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

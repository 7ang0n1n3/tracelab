import Fastify from "fastify";
import cors from "@fastify/cors";
import { chromium } from "playwright";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { executeScript } from "./execute";

const ARTIFACTS_PATH = process.env.ARTIFACTS_PATH || "./data/artifacts";

const app = Fastify({ logger: true });

// Track active auth recording sessions
const recordingSessions: Map<string, { close: () => Promise<void> }> = new Map();

// Track active codegen sessions
const codegenSessions: Map<string, { proc: ChildProcess; outputFile: string }> = new Map();

async function main() {
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ status: "ok" }));

  // ── Execute a test script ────────────────────────────────────────────────
  app.post("/execute", async (req, reply) => {
    const body = req.body as {
      runId: string;
      testId: string;
      script: string;
      baseUrl: string | null;
      authStatePath: string | null;
      config: {
        headless: boolean;
        slowMo: number;
        timeout: number;
        captureScreenshots: boolean;
        captureVideo: boolean;
        captureTrace: boolean;
      };
    };

    try {
      const result = await executeScript({
        runId: body.runId,
        script: body.script,
        baseUrl: body.baseUrl,
        authStatePath: body.authStatePath,
        config: body.config,
      });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── Auth state recording ─────────────────────────────────────────────────
  app.post("/record-auth", async (req, reply) => {
    const body = req.body as {
      authStateId: string;
      outputPath: string;
      baseUrl: string | null;
    };

    const authDir = path.dirname(body.outputPath);
    fs.mkdirSync(authDir, { recursive: true });

    try {
      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();

      if (body.baseUrl) {
        await page.goto(body.baseUrl);
      }

      recordingSessions.set(body.authStateId, {
        close: async () => {
          await context.storageState({ path: body.outputPath });
          await browser.close();
          recordingSessions.delete(body.authStateId);
        },
      });

      return reply.send({
        sessionId: body.authStateId,
        message: "Browser opened. Click Finish Recording when done logging in.",
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post("/record-auth/finish", async (req, reply) => {
    const body = req.body as { authStateId: string };
    const session = recordingSessions.get(body.authStateId);
    if (!session) {
      return reply.status(404).send({ error: "No active recording session" });
    }
    await session.close();
    return reply.send({ success: true });
  });

  // ── Playwright codegen recorder ──────────────────────────────────────────
  app.post("/codegen/start", async (req, reply) => {
    const body = req.body as { sessionId?: string; url?: string };
    const sessionId = body.sessionId ?? uuidv4();
    const outputFile = path.join(os.tmpdir(), `tracelab-codegen-${sessionId}.js`);

    const args = ["playwright", "codegen", "--output", outputFile];
    if (body.url) args.push(body.url);

    // npx resolves to the local playwright binary
    const proc = spawn("npx", args, {
      env: { ...process.env, DISPLAY: process.env.DISPLAY ?? ":99" },
      detached: false,
      stdio: "ignore",
    });

    proc.on("exit", () => codegenSessions.delete(sessionId));

    codegenSessions.set(sessionId, { proc, outputFile });

    return reply.send({ sessionId, message: "Codegen browser opened. Interact, then click Finish." });
  });

  app.post("/codegen/finish", async (req, reply) => {
    const body = req.body as { sessionId: string };
    const session = codegenSessions.get(body.sessionId);
    if (!session) {
      return reply.status(404).send({ error: "No active codegen session" });
    }

    // Kill the process — codegen writes output on exit
    session.proc.kill("SIGTERM");

    // Give the process a moment to flush the file
    await new Promise((r) => setTimeout(r, 800));

    let raw = "";
    if (fs.existsSync(session.outputFile)) {
      raw = fs.readFileSync(session.outputFile, "utf-8");
      fs.unlinkSync(session.outputFile);
    }

    codegenSessions.delete(body.sessionId);

    // Strip the import header and test() wrapper — extract the body
    const script = stripCodegenWrapper(raw);
    return reply.send({ script, raw });
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`TraceLab runner listening on :${port}`);
}

/**
 * Playwright codegen output looks like:
 *   import { test, expect } from '@playwright/test';
 *   test('test', async ({ page }) => {
 *     ...body...
 *   });
 *
 * We extract just the body so it can run in TraceLab's executor.
 */
function stripCodegenWrapper(raw: string): string {
  if (!raw.trim()) return "// No actions were recorded.";

  // Try to extract the body between the first async ({ page }) => { ... }
  const match = raw.match(/async\s*\(\s*\{[^}]*\}\s*\)\s*=>\s*\{([\s\S]*)\}\s*\);?\s*$/);
  if (match) {
    return match[1].trim();
  }

  // Fallback: strip import lines only
  return raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("import ") && !line.trim().startsWith("test("))
    .join("\n")
    .trim();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { chromium, Browser, BrowserContext } from "playwright";
import path from "path";
import fs from "fs";
import vm from "vm";

const ARTIFACTS_PATH = process.env.ARTIFACTS_PATH || "./data/artifacts";

export interface ExecuteOptions {
  runId: string;
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
}

export interface ExecuteResult {
  status: "passed" | "failed" | "error";
  exitCode: number;
  durationMs: number;
  log: string;
  errorMessage: string | null;
  screenshotPaths: string[];
  artifactPath: string;
}

export async function executeScript(opts: ExecuteOptions): Promise<ExecuteResult> {
  const { runId, script, authStatePath, config } = opts;
  const artifactDir = path.join(ARTIFACTS_PATH, runId);
  fs.mkdirSync(artifactDir, { recursive: true });

  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  const screenshotPaths: string[] = [];
  const startTime = Date.now();

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    log("Launching browser...");
    browser = await chromium.launch({
      headless: config.headless,
      slowMo: config.slowMo,
    });

    const contextOptions: Parameters<Browser["newContext"]>[0] = {
      viewport: { width: 1280, height: 720 },
    };

    if (authStatePath && fs.existsSync(authStatePath)) {
      log(`Loading auth state from ${path.basename(authStatePath)}`);
      contextOptions.storageState = authStatePath;
    }

    if (config.captureVideo) {
      contextOptions.recordVideo = { dir: artifactDir };
    }

    context = await browser.newContext(contextOptions);
    context.setDefaultTimeout(config.timeout);

    if (config.captureTrace) {
      await context.tracing.start({ screenshots: true, snapshots: true });
    }

    const page = await context.newPage();

    // Expose a screenshot helper into the script scope
    let screenshotIndex = 0;
    const takeScreenshot = async (label?: string) => {
      const name = label
        ? `${String(screenshotIndex++).padStart(3, "0")}-${label.replace(/\s+/g, "_")}.png`
        : `${String(screenshotIndex++).padStart(3, "0")}-screenshot.png`;
      const filePath = path.join(artifactDir, name);
      await page.screenshot({ path: filePath, fullPage: false });
      screenshotPaths.push(filePath);
      log(`Screenshot saved: ${name}`);
      return filePath;
    };

    log("Running test script...");

    if (script.length > 512 * 1024) {
      throw new Error("Script exceeds maximum allowed size (512KB)");
    }

    // Run in a vm context to restrict direct access to Node.js globals
    // (require, process, __dirname, etc. are not available in the sandbox)
    const sandbox = vm.createContext({ page, context, browser, takeScreenshot, log });
    const promise = vm.runInContext(`(async () => { ${script} })()`, sandbox, { displayErrors: true });
    await promise;

    if (config.captureScreenshots && screenshotPaths.length === 0) {
      await takeScreenshot("final");
    }

    if (config.captureTrace) {
      const tracePath = path.join(artifactDir, "trace.zip");
      await context.tracing.stop({ path: tracePath });
      log("Trace saved: trace.zip");
    }

    log("Test passed.");
    return {
      status: "passed",
      exitCode: 0,
      durationMs: Date.now() - startTime,
      log: logs.join("\n"),
      errorMessage: null,
      screenshotPaths,
      artifactPath: artifactDir,
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    log(`FAILED: ${msg}`);

    // Capture failure screenshot
    if (context) {
      try {
        const pages = context.pages();
        if (pages.length > 0) {
          const failPath = path.join(artifactDir, "failure.png");
          await pages[0].screenshot({ path: failPath });
          screenshotPaths.push(failPath);
          log("Failure screenshot saved.");
        }
      } catch {
        // best effort
      }
    }

    return {
      status: "failed",
      exitCode: 1,
      durationMs: Date.now() - startTime,
      log: logs.join("\n"),
      errorMessage: msg,
      screenshotPaths,
      artifactPath: artifactDir,
    };
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

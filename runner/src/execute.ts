import { chromium, firefox, webkit, Browser, BrowserContext } from "playwright";
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
    browser: "chromium" | "firefox" | "webkit";
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
  const { runId, script, baseUrl, authStatePath, config } = opts;
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
    const browserEngines = { chromium, firefox, webkit };
    const engine = browserEngines[config.browser] ?? chromium;
    log(`Launching ${config.browser} browser...`);
    browser = await engine.launch({
      headless: config.headless,
      slowMo: config.slowMo,
      ...(config.headless ? {} : { env: { ...process.env, DISPLAY: process.env.DISPLAY ?? ":99" } }),
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

    if (script.length > 100 * 1024) {
      throw new Error("Script exceeds maximum allowed size (100KB)");
    }

    // Deny-list proxy: allow the full Playwright API except methods that enable
    // SSRF, credential exfiltration, or untracked browser contexts.
    function denyProxy<T extends object>(obj: T, denied: Set<string>, label: string): T {
      return new Proxy(obj, {
        get(target, prop) {
          if (typeof prop === "string" && denied.has(prop)) {
            throw new Error(`[TraceLab] '${label}.${prop}' is not available in test scripts`);
          }
          const value = (target as any)[prop];
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    }

    // context: block request (SSRF), route interception, script injection,
    //          Node.js callback bridges, and direct storage-state dumps.
    const CONTEXT_DENIED = new Set([
      "request",         // APIRequestContext — arbitrary outbound HTTP / file reads
      "route",           // intercept + modify requests
      "unroute",
      "routeFromHAR",
      "addInitScript",   // injected into every new page in this context
      "exposeFunction",  // call Node.js fn from browser
      "exposeBinding",
      "storageState",    // dumps all cookies + localStorage
    ]);

    // page: block per-page equivalents of the above
    const PAGE_DENIED = new Set([
      "route",
      "unroute",
      "routeFromHAR",
      "addInitScript",
      "exposeFunction",
      "exposeBinding",
      "pdf",             // arbitrary file write to the runner filesystem
    ]);

    // browser: block creation of untracked contexts and raw CDP access
    const BROWSER_DENIED = new Set([
      "newContext",          // would bypass timeout / artifact / auth-state wiring
      "newBrowserCDPSession", // raw Chrome DevTools Protocol
    ]);

    const safePage    = denyProxy(page,    PAGE_DENIED,    "page");
    const safeContext = denyProxy(context, CONTEXT_DENIED, "context");
    const safeBrowser = denyProxy(browser, BROWSER_DENIED, "browser");

    // Run in a vm context to restrict direct access to Node.js globals
    // (require, process, __dirname, etc. are not available in the sandbox)
    const sandbox = vm.createContext({
      page: safePage,
      context: safeContext,
      browser: safeBrowser,
      takeScreenshot,
      log,
      baseUrl: opts.baseUrl,
    });
    // timeout applies to synchronous code only — Playwright's own timeout handles async operations
    const promise = vm.runInContext(`(async () => { ${script} })()`, sandbox, { displayErrors: true, timeout: 5000 });
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

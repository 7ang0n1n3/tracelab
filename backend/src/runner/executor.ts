// /backend/src/runner/executor.ts
import axios from "axios";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { Test, RunConfig, RunResult, AuthState, ChainLink } from "../types";

const RUNNER_URL = process.env.RUNNER_URL || "http://runner:5000";
const ARTIFACTS_PATH = process.env.ARTIFACTS_PATH || "./data/artifacts";
const RUNNER_NOVNC_PORT = parseInt(process.env.RUNNER_NOVNC_PORT || "6080", 10);
const RUNNER_SECRET = process.env.RUNNER_SECRET || "";

function runnerHeaders(): Record<string, string> {
  return RUNNER_SECRET ? { Authorization: `Bearer ${RUNNER_SECRET}` } : {};
}

function getSettings(): RunConfig & { defaultBrowser: "chromium" | "firefox" | "webkit"; retryCount: number } {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const validBrowsers = ["chromium", "firefox", "webkit"] as const;
  const defaultBrowser = validBrowsers.includes(s.defaultBrowser as "chromium" | "firefox" | "webkit")
    ? (s.defaultBrowser as "chromium" | "firefox" | "webkit")
    : "chromium";
  return {
    headless: s.headless !== "false",
    slowMo: parseInt(s.slowMo || "0", 10),
    timeout: parseInt(s.timeout || "30000", 10),
    captureScreenshots: s.captureScreenshots !== "false",
    captureVideo: s.captureVideo === "true",
    captureTrace: s.captureTrace === "true",
    browser: defaultBrowser,
    defaultBrowser,
    retryCount: Math.max(0, parseInt(s.retryCount || "0", 10)),
  };
}

function resolveRunConfig(
  test: Test,
  settings: RunConfig & { defaultBrowser: "chromium" | "firefox" | "webkit" }
): RunConfig {
  const validBrowsers = ["chromium", "firefox", "webkit"] as const;
  const config: RunConfig = { ...settings };
  config.browser = validBrowsers.includes(test.browser as "chromium" | "firefox" | "webkit")
    ? (test.browser as "chromium" | "firefox" | "webkit")
    : settings.defaultBrowser;
  if (test.capture_video !== null && test.capture_video !== undefined) {
    config.captureVideo = test.capture_video === 1;
  }
  if (test.headless !== null && test.headless !== undefined) {
    config.headless = test.headless === 1;
  }
  return config;
}

function lookupAuthState(test: Test): string | null {
  if (!test.use_auth || !test.auth_state_id) return null;
  const state = db
    .prepare("SELECT * FROM auth_states WHERE id = ?")
    .get(test.auth_state_id) as AuthState | undefined;
  if (!state) return null;
  db.prepare("UPDATE auth_states SET last_used_at = ? WHERE id = ?").run(Date.now(), state.id);
  return state.file_path;
}

async function startVncIfHeaded(runId: string, headless: boolean): Promise<void> {
  if (headless) return;
  try {
    await axios.post(`${RUNNER_URL}/execute/vnc-start`, { runId }, { headers: runnerHeaders() });
    db.prepare("UPDATE runs SET vnc_port = ? WHERE id = ?").run(RUNNER_NOVNC_PORT, runId);
  } catch {
    // VNC failed to start — continue without it (test still runs headlessly via DISPLAY)
  }
}

async function invokeRunner(
  runId: string,
  test: Test,
  authStatePath: string | null,
  config: RunConfig
): Promise<"passed" | "failed" | "error"> {
  try {
    const response = await axios.post<RunResult>(`${RUNNER_URL}/execute`, {
      runId,
      testId: test.id,
      script: test.script,
      baseUrl: test.base_url,
      authStatePath,
      config,
    }, { headers: runnerHeaders() });

    const result = response.data;
    db.prepare(`
      UPDATE runs SET
        status = ?, finished_at = ?, duration_ms = ?,
        exit_code = ?, log = ?, artifact_path = ?, error_message = ?
      WHERE id = ?
    `).run(
      result.status,
      Date.now(),
      result.durationMs,
      result.exitCode,
      result.log,
      path.join(ARTIFACTS_PATH, runId),
      result.errorMessage,
      runId
    );
    return result.status;
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
      || (err as Error).message
      || "Runner error";
    db.prepare(`
      UPDATE runs SET status = 'error', finished_at = ?, error_message = ? WHERE id = ?
    `).run(Date.now(), msg, runId);
    return "error";
  }
}

function dispatchChainLinks(
  test: Test,
  finalStatus: "passed" | "failed" | "error",
  chainRunId: string | undefined,
  triggeringRunId: string
): void {
  const links = db.prepare(
    "SELECT * FROM chain_links WHERE from_test_id = ?"
  ).all(test.id) as unknown as ChainLink[];

  for (const link of links) {
    if (finalStatus === "passed" || link.continue_on_failure === 1) {
      const nextTest = db.prepare("SELECT * FROM tests WHERE id = ?").get(link.to_test_id) as Test | undefined;
      if (!nextTest) continue;
      const nextRunId = uuidv4();
      const effectiveChainRunId = chainRunId ?? triggeringRunId;
      db.prepare(
        "INSERT INTO runs (id, test_id, status, attempt, chain_run_id, triggered_by_run_id, created_at) VALUES (?, ?, 'pending', 1, ?, ?, ?)"
      ).run(nextRunId, nextTest.id, effectiveChainRunId, triggeringRunId, Date.now());
      dispatchRun(nextRunId, nextTest, 1, undefined, effectiveChainRunId, triggeringRunId)
        .catch((err) => console.error("Chain dispatch error:", err));
    }
  }
}

export async function dispatchRun(
  runId: string,
  test: Test,
  attempt = 1,
  parentRunId?: string,
  chainRunId?: string,
  triggeredByRunId?: string,
) {
  const { defaultBrowser, retryCount: systemRetryCount, ...settings } = getSettings();
  const config = resolveRunConfig(test, { ...settings, defaultBrowser });
  const authStatePath = lookupAuthState(test);

  db.prepare("UPDATE runs SET status = 'running', started_at = ? WHERE id = ?").run(Date.now(), runId);

  await startVncIfHeaded(runId, config.headless);

  const finalStatus = await invokeRunner(runId, test, authStatePath, config);

  // Retry on failure — return early so chain is not triggered until retries are exhausted
  if (finalStatus === "failed" || finalStatus === "error") {
    const maxRetries = test.retry_count !== null && test.retry_count !== undefined
      ? test.retry_count
      : systemRetryCount;
    if (attempt <= maxRetries) {
      const retryRunId = uuidv4();
      const effectiveParentId = parentRunId ?? runId;
      db.prepare(
        "INSERT INTO runs (id, test_id, status, attempt, parent_run_id, chain_run_id, triggered_by_run_id, created_at) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)"
      ).run(retryRunId, test.id, attempt + 1, effectiveParentId, chainRunId ?? null, triggeredByRunId ?? null, Date.now());
      dispatchRun(retryRunId, test, attempt + 1, effectiveParentId, chainRunId, triggeredByRunId)
        .catch((err) => console.error("Retry dispatch error:", err));
      return;
    }
  }

  dispatchChainLinks(test, finalStatus, chainRunId, runId);
}

import axios from "axios";
import path from "path";
import db from "../db/client";
import { Test, RunConfig, RunResult, AuthState } from "../types";

const RUNNER_URL = process.env.RUNNER_URL || "http://runner:5000";
const ARTIFACTS_PATH = process.env.ARTIFACTS_PATH || "./data/artifacts";

function getSettings(): RunConfig {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    headless: s.headless !== "false",
    slowMo: parseInt(s.slowMo || "0", 10),
    timeout: parseInt(s.timeout || "30000", 10),
    captureScreenshots: s.captureScreenshots !== "false",
    captureVideo: s.captureVideo === "true",
    captureTrace: s.captureTrace === "true",
  };
}

export async function dispatchRun(runId: string, test: Test) {
  const config = getSettings();

  let authStatePath: string | null = null;
  if (test.use_auth && test.auth_state_id) {
    const state = db
      .prepare("SELECT * FROM auth_states WHERE id = ?")
      .get(test.auth_state_id) as AuthState | undefined;
    if (state) {
      authStatePath = state.file_path;
      db.prepare("UPDATE auth_states SET last_used_at = ? WHERE id = ?").run(Date.now(), state.id);
    }
  }

  // Mark run as running
  db.prepare("UPDATE runs SET status = 'running', started_at = ? WHERE id = ?").run(Date.now(), runId);

  try {
    const response = await axios.post<RunResult>(`${RUNNER_URL}/execute`, {
      runId,
      testId: test.id,
      script: test.script,
      baseUrl: test.base_url,
      authStatePath,
      config,
    });

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
  } catch (err: any) {
    const msg = err?.response?.data?.error || err.message || "Runner error";
    db.prepare(`
      UPDATE runs SET status = 'error', finished_at = ?, error_message = ? WHERE id = ?
    `).run(Date.now(), msg, runId);
  }
}

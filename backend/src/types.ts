export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: "admin" | "dev" | "qa";
  disabled: number; // 0 = active, 1 = disabled
  must_change_password: number; // 0 = no, 1 = yes
  last_login: number | null;
  created_at: number;
  updated_at: number;
}

export interface Session {
  id: string;
  user_id: string;
  created_at: number;
  expires_at: number;
}

export interface Test {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  app_name: string | null;
  base_url: string | null;
  script: string;
  tags: string | null; // JSON array string
  auth_state_id: string | null;
  use_auth: number; // 0 or 1
  browser: "chromium" | "firefox" | "webkit" | null; // null = use system default
  capture_video: number | null; // null = use system default, 0 = off, 1 = on
  headless: number | null; // null = use system default, 0 = off, 1 = on
  retry_count: number | null; // null = use system default
  created_at: number;
  updated_at: number;
}

export interface Run {
  id: string;
  test_id: string;
  status: "pending" | "running" | "passed" | "failed" | "error";
  started_at: number | null;
  finished_at: number | null;
  duration_ms: number | null;
  exit_code: number | null;
  log: string | null;
  artifact_path: string | null;
  error_message: string | null;
  attempt: number; // 1-based, increments on retry
  parent_run_id: string | null; // set on retry attempts, points to first run
  chain_run_id: string | null; // all chain-triggered runs share the first run's ID
  triggered_by_run_id: string | null; // which run directly triggered this one
  created_at: number;
}

export interface ChainLink {
  id: string;
  from_test_id: string;
  to_test_id: string;
  continue_on_failure: number; // 0 or 1
  created_at: number;
}

export interface AuthState {
  id: string;
  user_id: string | null;
  name: string;
  app_name: string | null;
  base_url: string | null;
  file_path: string;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
}

export interface TestShare {
  id: string;
  test_id: string;
  grantee_type: "user" | "role";
  grantee_id: string;
  permission: "read" | "write";
  created_at: number;
}

export interface Schedule {
  id: string;
  test_id: string;
  label: string | null;
  cron_expr: string;
  enabled: number; // 0 or 1
  last_run_at: number | null;
  next_run_at: number | null;
  created_at: number;
  created_by: string | null;
}

export interface Setting {
  key: string;
  value: string;
}

export interface RunJob {
  runId: string;
  testId: string;
  script: string;
  baseUrl: string | null;
  authStatePath: string | null;
  config: RunConfig;
}

export interface RunConfig {
  headless: boolean;
  slowMo: number;
  timeout: number;
  captureScreenshots: boolean;
  captureVideo: boolean;
  captureTrace: boolean;
  browser: "chromium" | "firefox" | "webkit";
}

export interface RunResult {
  runId: string;
  status: "passed" | "failed" | "error";
  exitCode: number;
  durationMs: number;
  log: string;
  errorMessage: string | null;
  screenshotPaths: string[];
  artifactPath: string;
}

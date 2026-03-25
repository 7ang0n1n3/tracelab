// /frontend/src/types.ts
// Frontend DTO types — mirrors backend/src/types.ts and adds API-augmented response shapes

export interface User {
  id: string;
  username: string;
  role: "admin" | "dev" | "qa";
  disabled: number;
  must_change_password: number;
  last_login: number | null;
  created_at: number;
  updated_at: number;
}

export interface DirectoryUser {
  id: string;
  username: string;
  role: "admin" | "dev" | "qa";
}

export interface Test {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  app_name: string | null;
  base_url: string | null;
  script: string;
  tags: string | null;
  auth_state_id: string | null;
  use_auth: number;
  browser: "chromium" | "firefox" | "webkit" | null;
  capture_video: number | null;
  headless: number | null;
  retry_count: number | null;
  created_at: number;
  updated_at: number;
}

export interface TestDetail extends Test {
  _access: "owner" | "admin" | "read" | "write";
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
  attempt: number;
  parent_run_id: string | null;
  chain_run_id: string | null;
  triggered_by_run_id: string | null;
  created_at: number;
  vnc_port: number | null;
}

export interface RunDetail extends Run {
  screenshots: string[];
}

export interface ChainLink {
  id: string;
  from_test_id: string;
  to_test_id: string;
  continue_on_failure: number;
  created_at: number;
}

export interface OutgoingChainLink extends ChainLink {
  to_test_name: string;
}

export interface IncomingChainLink extends ChainLink {
  from_test_name: string;
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

export interface TestShareDetail extends TestShare {
  grantee_label: string;
}

export interface Schedule {
  id: string;
  test_id: string;
  label: string | null;
  cron_expr: string;
  enabled: number;
  last_run_at: number | null;
  next_run_at: number | null;
  created_at: number;
  created_by: string | null;
}

export interface ArtifactFile {
  name: string;
  url: string;
}

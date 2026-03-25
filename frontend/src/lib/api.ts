// /frontend/src/lib/api.ts
import {
  TestDetail,
  RunDetail,
  Run,
  AuthState,
  TestShareDetail,
  Schedule,
  OutgoingChainLink,
  IncomingChainLink,
  ChainLink,
  User,
  DirectoryUser,
  ArtifactFile,
} from "@/types";

const BASE = "/api";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...options?.headers as Record<string, string> };
  if (options?.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Tests
  tests: {
    list: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return apiFetch<TestDetail[]>(`/tests${qs}`);
    },
    get: (id: string) => apiFetch<TestDetail>(`/tests/${id}`),
    create: (data: Partial<TestDetail>) => apiFetch<TestDetail>("/tests", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<TestDetail>) => apiFetch<TestDetail>(`/tests/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<void>(`/tests/${id}`, { method: "DELETE" }),
    duplicate: (id: string) => apiFetch<TestDetail>(`/tests/${id}/duplicate`, { method: "POST" }),
    run: (id: string) => apiFetch<{ runId: string }>(`/tests/${id}/run`, { method: "POST" }),
    shares: {
      list: (testId: string) => apiFetch<TestShareDetail[]>(`/tests/${testId}/shares`),
      add: (testId: string, data: { grantee_type: string; grantee_id: string; permission: string }) =>
        apiFetch<TestShareDetail>(`/tests/${testId}/shares`, { method: "POST", body: JSON.stringify(data) }),
      remove: (testId: string, shareId: string) =>
        apiFetch<void>(`/tests/${testId}/shares/${shareId}`, { method: "DELETE" }),
    },
  },

  // Runs
  runs: {
    list: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return apiFetch<Run[]>(`/runs${qs}`);
    },
    get: (id: string) => apiFetch<RunDetail>(`/runs/${id}`),
    delete: (id: string) => apiFetch<void>(`/runs/${id}`, { method: "DELETE" }),
  },

  // Auth states
  authStates: {
    list: () => apiFetch<AuthState[]>("/auth-states"),
    create: (data: Partial<AuthState>) => apiFetch<AuthState>("/auth-states", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<void>(`/auth-states/${id}`, { method: "DELETE" }),
    record: (id: string) => apiFetch<{ sessionId: string; vncPort: number; message: string }>(`/auth-states/${id}/record`, { method: "POST" }),
    finishRecord: (id: string) => apiFetch<AuthState>(`/auth-states/${id}/finish-record`, { method: "POST" }),
    refresh: (id: string) => apiFetch<AuthState>(`/auth-states/${id}/refresh`, { method: "POST" }),
    status: (id: string) => apiFetch<{ status: string; message?: string }>(`/auth-states/${id}/status`),
  },

  // Codegen recorder
  codegen: {
    start: (data: { url?: string; sessionId?: string }) =>
      apiFetch<{ sessionId: string; vncPort: number; message: string }>("/codegen/start", { method: "POST", body: JSON.stringify(data) }),
    finish: (sessionId: string) =>
      apiFetch<{ script: string; raw: string }>("/codegen/finish", { method: "POST", body: JSON.stringify({ sessionId }) }),
  },

  // Settings
  settings: {
    get: () => apiFetch<Record<string, string>>("/settings"),
    update: (data: Record<string, string>) =>
      apiFetch<Record<string, string>>("/settings", { method: "PUT", body: JSON.stringify(data) }),
  },

  // Users
  users: {
    directory: () => apiFetch<DirectoryUser[]>("/users/directory"),
    list: () => apiFetch<User[]>("/users"),
    create: (data: { username: string; password: string; role: string }) =>
      apiFetch<User>("/users", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { username?: string; password?: string; role?: string; disabled?: boolean }) =>
      apiFetch<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
  },

  // Auth
  auth: {
    me: () => apiFetch<User>("/auth/me"),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      apiFetch<{ ok: boolean }>("/auth/change-password", { method: "POST", body: JSON.stringify(data) }),
  },

  // Schedules
  schedules: {
    list: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return apiFetch<Schedule[]>(`/schedules${qs}`);
    },
    get: (id: string) => apiFetch<Schedule>(`/schedules/${id}`),
    create: (data: { test_id: string; cron_expr: string; label?: string }) =>
      apiFetch<Schedule>("/schedules", { method: "POST", body: JSON.stringify(data) }),
    patch: (id: string, data: { cron_expr?: string; label?: string; enabled?: number }) =>
      apiFetch<Schedule>(`/schedules/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<void>(`/schedules/${id}`, { method: "DELETE" }),
  },

  // Chain links
  chain: {
    get: (testId: string) => apiFetch<{ outgoing: OutgoingChainLink[]; incoming: IncomingChainLink[] }>(`/tests/${testId}/chain`),
    add: (data: { from_test_id: string; to_test_id: string; continue_on_failure?: number }) =>
      apiFetch<ChainLink>("/chain-links", { method: "POST", body: JSON.stringify(data) }),
    patch: (id: string, data: { continue_on_failure: number }) =>
      apiFetch<ChainLink>(`/chain-links/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: string) => apiFetch<void>(`/chain-links/${id}`, { method: "DELETE" }),
  },

  // Artifacts
  artifacts: {
    screenshots: (runId: string) => apiFetch<string[]>(`/artifacts/${runId}/screenshots`),
    list: (runId: string) => apiFetch<{ files: ArtifactFile[] }>(`/artifacts/${runId}`),
    fileUrl: (runId: string, name: string) => `/api/artifacts/${runId}/file/${name}`,
    exportUrl: (runId: string) => `/api/artifacts/${runId}/export`,
  },
};

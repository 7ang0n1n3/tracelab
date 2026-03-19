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
      return apiFetch<any[]>(`/tests${qs}`);
    },
    get: (id: string) => apiFetch<any>(`/tests/${id}`),
    create: (data: any) => apiFetch<any>("/tests", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<any>(`/tests/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<void>(`/tests/${id}`, { method: "DELETE" }),
    duplicate: (id: string) => apiFetch<any>(`/tests/${id}/duplicate`, { method: "POST" }),
    run: (id: string) => apiFetch<{ runId: string }>(`/tests/${id}/run`, { method: "POST" }),
    shares: {
      list: (testId: string) => apiFetch<any[]>(`/tests/${testId}/shares`),
      add: (testId: string, data: { grantee_type: string; grantee_id: string; permission: string }) =>
        apiFetch<any>(`/tests/${testId}/shares`, { method: "POST", body: JSON.stringify(data) }),
      remove: (testId: string, shareId: string) =>
        apiFetch<void>(`/tests/${testId}/shares/${shareId}`, { method: "DELETE" }),
    },
  },

  // Runs
  runs: {
    list: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return apiFetch<any[]>(`/runs${qs}`);
    },
    get: (id: string) => apiFetch<any>(`/runs/${id}`),
    delete: (id: string) => apiFetch<void>(`/runs/${id}`, { method: "DELETE" }),
  },

  // Auth states
  authStates: {
    list: () => apiFetch<any[]>("/auth-states"),
    create: (data: any) => apiFetch<any>("/auth-states", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<void>(`/auth-states/${id}`, { method: "DELETE" }),
    record: (id: string) => apiFetch<any>(`/auth-states/${id}/record`, { method: "POST" }),
    finishRecord: (id: string) => apiFetch<any>(`/auth-states/${id}/finish-record`, { method: "POST" }),
    refresh: (id: string) => apiFetch<any>(`/auth-states/${id}/refresh`, { method: "POST" }),
    status: (id: string) => apiFetch<any>(`/auth-states/${id}/status`),
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
    directory: () => apiFetch<any[]>("/users/directory"),
    list: () => apiFetch<any[]>("/users"),
    create: (data: { username: string; password: string; role: string }) =>
      apiFetch<any>("/users", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { username?: string; password?: string; role?: string; disabled?: boolean }) =>
      apiFetch<any>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
  },

  // Artifacts
  artifacts: {
    screenshots: (runId: string) => apiFetch<any[]>(`/artifacts/${runId}/screenshots`),
    list: (runId: string) => apiFetch<any>(`/artifacts/${runId}`),
    fileUrl: (runId: string, name: string) => `/api/artifacts/${runId}/file/${name}`,
  },
};

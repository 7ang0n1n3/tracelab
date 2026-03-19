"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Trash2, UserPlus } from "lucide-react";

interface Props {
  testId: string;
}

export function SharesPanel({ testId }: Props) {
  const [shares, setShares] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [granteeType, setGranteeType] = useState<"user" | "role">("user");
  const [granteeId, setGranteeId] = useState("");
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [adding, setAdding] = useState(false);

  async function loadShares() {
    try {
      const [s, u] = await Promise.all([
        api.tests.shares.list(testId),
        api.users.directory(),
      ]);
      setShares(s);
      setUsers(u);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadShares(); }, [testId]);

  async function handleAdd() {
    if (!granteeId) return;
    setAdding(true);
    setError(null);
    try {
      await api.tests.shares.add(testId, { grantee_type: granteeType, grantee_id: granteeId, permission });
      setGranteeId("");
      await loadShares();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(shareId: string) {
    try {
      await api.tests.shares.remove(testId, shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (e: any) {
      setError(e.message);
    }
  }

  const selectClass = "bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-accent";
  const inputClass = "bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-accent";

  return (
    <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border text-sm font-medium text-slate-300">
        Sharing
      </div>
      <div className="p-4 space-y-4">
        {error && (
          <div className="text-red-400 text-xs">{error}</div>
        )}

        {/* Current shares */}
        {loading ? (
          <div className="text-muted text-xs">Loading...</div>
        ) : shares.length === 0 ? (
          <div className="text-muted text-xs">Not shared with anyone.</div>
        ) : (
          <ul className="space-y-1.5">
            {shares.map((s) => (
              <li key={s.id} className="flex items-center justify-between bg-bg-elevated rounded px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-300">{s.grantee_label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                    s.permission === "write"
                      ? "bg-blue-900/40 text-blue-300 border border-blue-700/30"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700/30"
                  }`}>
                    {s.permission}
                  </span>
                </div>
                <button
                  onClick={() => handleRemove(s.id)}
                  className="text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add share form */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={granteeType}
            onChange={(e) => { setGranteeType(e.target.value as "user" | "role"); setGranteeId(""); }}
            className={selectClass}
          >
            <option value="user">User</option>
            <option value="role">Role</option>
          </select>

          {granteeType === "user" ? (
            <select value={granteeId} onChange={(e) => setGranteeId(e.target.value)} className={selectClass}>
              <option value="">— Select user —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.role})
                </option>
              ))}
            </select>
          ) : (
            <select value={granteeId} onChange={(e) => setGranteeId(e.target.value)} className={selectClass}>
              <option value="">— Select role —</option>
              <option value="admin">admin</option>
              <option value="dev">dev</option>
              <option value="qa">qa</option>
            </select>
          )}

          <select value={permission} onChange={(e) => setPermission(e.target.value as "read" | "write")} className={selectClass}>
            <option value="read">Read-only</option>
            <option value="write">Read-write</option>
          </select>

          <Button variant="ghost" size="sm" onClick={handleAdd} disabled={adding || !granteeId}>
            <UserPlus size={13} />
            {adding ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}

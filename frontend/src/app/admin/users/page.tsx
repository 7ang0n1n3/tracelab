"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2, Pencil, X, Check, Ban, CircleCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDistanceToNow } from "date-fns";

type User = { id: string; username: string; role: string; disabled: number; last_login: number | null; created_at: number };

const ROLES = ["admin", "dev", "qa"] as const;

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-violet-900/40 text-violet-300 border-violet-700/40",
    dev: "bg-blue-900/40 text-blue-300 border-blue-700/40",
    qa: "bg-green-900/40 text-green-300 border-green-700/40",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-mono ${colors[role] ?? "bg-bg-elevated text-muted border-border"}`}>
      {role}
    </span>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const firstAdminId = users
    .filter((u) => u.role === "admin")
    .sort((a, b) => a.created_at - b.created_at)[0]?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ username: "", password: "", role: "qa" });
  const [editForm, setEditForm] = useState({ username: "", password: "", role: "qa" });
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  async function load() {
    setLoading(true);
    try {
      setUsers(await api.users.list());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.users.create({ username: form.username, password: form.password, role: form.role });
      setForm({ username: "", password: "", role: "qa" });
      setShowCreate(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(user: User) {
    setEditId(user.id);
    setEditForm({ username: user.username, password: "", role: user.role });
    setError("");
  }

  async function handleEdit(id: string) {
    setError("");
    try {
      const payload: Record<string, string> = { role: editForm.role };
      if (editForm.username) payload.username = editForm.username;
      if (editForm.password) payload.password = editForm.password;
      await api.users.update(id, payload);
      setEditId(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleToggleDisabled(user: User) {
    const action = user.disabled ? "Enable" : "Disable";
    setConfirm({
      message: `${action} account "${user.username}"?`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.users.update(user.id, { disabled: !user.disabled });
          load();
        } catch (err: any) {
          setError(err.message);
        }
      },
    });
  }

  function handleDelete(id: string, username: string) {
    setConfirm({
      message: `Delete user "${username}"?`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.users.delete(id);
          load();
        } catch (err: any) {
          setError(err.message);
        }
      },
    });
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          confirmLabel="Confirm"
        />
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">User Management</h1>
        <Button size="sm" onClick={() => { setShowCreate(true); setError(""); }}>
          <Plus size={13} className="mr-1.5" />
          New User
        </Button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-slate-200 mb-4">Create User</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs text-muted mb-1">Username</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent-bright"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent-bright"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent-bright"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-span-3 flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" size="sm">Create</Button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : (
        <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs text-muted font-medium">Username</th>
                <th className="px-4 py-3 text-xs text-muted font-medium">Role</th>
                <th className="px-4 py-3 text-xs text-muted font-medium">Last Login</th>
                <th className="px-4 py-3 text-xs text-muted font-medium">Created</th>
                <th className="px-4 py-3 text-xs text-muted font-medium w-28"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  {editId === user.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editForm.username}
                          onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                          placeholder={user.username}
                          className="bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-accent-bright w-full"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          className="bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-accent-bright"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2">
                        <input
                          type="password"
                          placeholder="New password (optional)"
                          value={editForm.password}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                          className="bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-accent-bright w-full"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => handleEdit(user.id)} className="p-1.5 rounded text-green-400 hover:bg-green-900/20 transition-colors"><Check size={13} /></button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded text-muted hover:bg-bg-elevated transition-colors"><X size={13} /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className={`font-mono ${user.disabled ? "text-muted line-through" : "text-slate-200"}`}>{user.username}</span>
                        {!!user.disabled && <span className="ml-2 text-xs text-orange-400 border border-orange-700/40 bg-orange-900/20 rounded px-1.5 py-0.5">disabled</span>}
                      </td>
                      <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {user.last_login ? formatDistanceToNow(user.last_login, { addSuffix: true }) : "Never"}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">{new Date(user.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => startEdit(user)} className="p-1.5 rounded text-muted hover:text-slate-200 hover:bg-bg-elevated transition-colors"><Pencil size={13} /></button>
                          <button
                            onClick={() => handleToggleDisabled(user)}
                            title={user.id === firstAdminId ? "Primary admin cannot be disabled" : user.disabled ? "Enable account" : "Disable account"}
                            disabled={user.id === firstAdminId}
                            className={`p-1.5 rounded transition-colors ${user.id === firstAdminId ? "opacity-30 cursor-not-allowed text-muted" : user.disabled ? "text-green-500 hover:bg-green-900/20" : "text-muted hover:text-orange-400 hover:bg-orange-900/20"}`}
                          >
                            {user.disabled ? <CircleCheck size={13} /> : <Ban size={13} />}
                          </button>
                          <button onClick={() => handleDelete(user.id, user.username)} className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-red-900/20 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted text-sm">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

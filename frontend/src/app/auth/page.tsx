"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2, RefreshCw, Video, CheckCircle } from "lucide-react";

export default function AuthPage() {
  const [states, setStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", app_name: "", base_url: "" });
  // activeRecording holds the id of the auth state currently being recorded
  const [activeRecording, setActiveRecording] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setStates(await api.authStates.list());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setError(null);
    try {
      await api.authStates.create(form);
      setForm({ name: "", app_name: "", base_url: "" });
      setCreating(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleRecord(id: string) {
    setError(null);
    try {
      await api.authStates.record(id);
      setActiveRecording(id);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleFinishRecord() {
    if (!activeRecording) return;
    setFinishing(true);
    setError(null);
    try {
      await api.authStates.finishRecord(activeRecording);
      setActiveRecording(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFinishing(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete auth state "${name}"?`)) return;
    await api.authStates.delete(id);
    load();
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Auth States</h1>
          <p className="text-sm text-muted mt-0.5">Saved browser sessions for reuse in tests</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreating(!creating)}>
          <Plus size={13} />
          New Auth State
        </Button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/40 text-red-400 text-sm px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Active recording banner */}
      {activeRecording && (
        <div className="bg-blue-900/30 border border-blue-600/40 rounded-lg px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-blue-300 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Recording in progress
            </div>
            <div className="text-xs text-blue-400/70 mt-1">
              A browser window is open on the runner. Log in to your app, then click Finish.
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={handleFinishRecord} disabled={finishing}>
            <CheckCircle size={13} />
            {finishing ? "Saving..." : "Finish Recording"}
          </Button>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="bg-bg-surface border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-medium text-slate-200">New Auth State</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="homelab-admin"
                className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">App</label>
              <input value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.target.value })}
                placeholder="Grafana"
                className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Base URL</label>
            <input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="https://grafana.lab.local"
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleCreate}>Create</Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-muted text-sm">Loading...</div>
        ) : states.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">
            No auth states saved. Create one and record a login to reuse it in tests.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">App</th>
                <th className="text-left px-4 py-2">URL</th>
                <th className="text-left px-4 py-2">Last Updated</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {states.map((s) => {
                const isRecording = activeRecording === s.id;
                return (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-bg-elevated transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {s.name}
                      {isRecording && (
                        <span className="ml-2 text-xs text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">
                          recording
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">{s.app_name || "—"}</td>
                    <td className="px-4 py-3 text-muted text-xs truncate max-w-[180px]">{s.base_url || "—"}</td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {formatDistanceToNow(s.updated_at, { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {isRecording ? (
                          <Button variant="primary" size="sm" onClick={handleFinishRecord} disabled={finishing}>
                            <CheckCircle size={11} />
                            Finish
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm"
                            onClick={() => handleRecord(s.id)}
                            disabled={!!activeRecording}>
                            <Video size={11} />
                            Record Login
                          </Button>
                        )}
                        <Button variant="ghost" size="sm"
                          onClick={() => api.authStates.refresh(s.id).then(load)}
                          disabled={!!activeRecording}>
                          <RefreshCw size={11} />
                        </Button>
                        <Button variant="ghost" size="sm"
                          onClick={() => handleDelete(s.id, s.name)}
                          disabled={!!activeRecording}>
                          <Trash2 size={11} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-muted bg-bg-surface border border-border rounded px-4 py-3">
        Auth state files are stored server-side and never exposed in the UI. They contain browser cookies and localStorage for the target app.
      </div>
    </div>
  );
}

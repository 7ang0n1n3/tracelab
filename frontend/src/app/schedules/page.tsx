// /frontend/src/app/schedules/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { cronToHuman } from "@/lib/schedule";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ScheduleBuilder } from "@/components/ui/ScheduleBuilder";
import { RefreshCw, Trash2, Power, Plus, Clock } from "lucide-react";

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // New schedule form
  const [showForm, setShowForm] = useState(false);
  const [formTestId, setFormTestId] = useState("");
  const [formCron, setFormCron] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([api.schedules.list(), api.tests.list()]);
      setSchedules(s);
      setTests(t);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(sched: any) {
    try {
      await api.schedules.patch(sched.id, { enabled: sched.enabled ? 0 : 1 });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function handleDeletePrompt(sched: any) {
    setConfirm({
      message: `Delete "${cronToHuman(sched.cron_expr)}" schedule for "${sched.test_name}"?`,
      onConfirm: async () => {
        setConfirm(null);
        await api.schedules.delete(sched.id);
        await load();
      },
    });
  }

  async function handleCreate() {
    if (!formTestId || !formCron) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await api.schedules.create({ test_id: formTestId, cron_expr: formCron });
      setShowForm(false);
      setFormTestId("");
      setFormCron("");
      await load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent";

  return (
    <div className="space-y-5">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Schedules</h1>
          <p className="text-sm text-muted mt-0.5">{schedules.length} schedule{schedules.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw size={13} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus size={13} />
            New Schedule
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/40 text-red-400 text-sm px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-bg-surface border border-border rounded-lg p-5 space-y-4">
          <div className="text-sm font-medium text-slate-300">New Schedule</div>
          {formError && <div className="text-red-400 text-xs">{formError}</div>}

          <div>
            <label className="block text-xs text-muted mb-1">Test</label>
            <select
              value={formTestId}
              onChange={(e) => setFormTestId(e.target.value)}
              className={`${inputClass} w-full max-w-xs`}
            >
              <option value="">— Select a test —</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted mb-2">Schedule</label>
            <ScheduleBuilder onChange={setFormCron} />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={submitting || !formTestId || !formCron}
            >
              {submitting ? "Creating..." : "Create Schedule"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Schedules table */}
      {loading ? (
        <div className="text-muted text-sm">Loading...</div>
      ) : schedules.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-lg px-4 py-10 text-center text-muted text-sm">
          No schedules configured. Create one to run tests on a time-based trigger.
        </div>
      ) : (
        <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-4 py-2.5 text-left font-normal">Test</th>
                <th className="px-4 py-2.5 text-left font-normal">Schedule</th>
                <th className="px-4 py-2.5 text-left font-normal">Next Run</th>
                <th className="px-4 py-2.5 text-left font-normal">Last Run</th>
                <th className="px-4 py-2.5 text-left font-normal">Status</th>
                <th className="px-4 py-2.5 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((sched) => (
                <tr key={sched.id} className="border-b border-border/50 hover:bg-bg-elevated transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/tests/${sched.test_id}`} className="text-accent-bright hover:underline">
                      {sched.test_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-200">{cronToHuman(sched.cron_expr)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {sched.next_run_at
                      ? format(sched.next_run_at, "MMM d, HH:mm")
                      : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {sched.last_run_at
                      ? format(sched.last_run_at, "MMM d, HH:mm")
                      : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 text-xs w-fit px-2 py-0.5 rounded-full border ${
                      sched.enabled
                        ? "bg-green-900/20 border-green-700/30 text-green-400"
                        : "bg-zinc-800 border-zinc-700/40 text-muted"
                    }`}>
                      <Clock size={10} />
                      {sched.enabled ? "active" : "disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleToggle(sched)}
                        title={sched.enabled ? "Disable" : "Enable"}
                        className={`transition-colors ${sched.enabled ? "text-accent-bright hover:text-muted" : "text-muted hover:text-accent-bright"}`}
                      >
                        <Power size={13} />
                      </button>
                      <button
                        onClick={() => handleDeletePrompt(sched)}
                        className="text-muted hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

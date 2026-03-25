// /frontend/src/components/test/SchedulesPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { cronToHuman } from "@/lib/schedule";
import { Button } from "@/components/ui/Button";
import { ScheduleBuilder } from "@/components/ui/ScheduleBuilder";
import { Trash2, Plus, Clock, Power } from "lucide-react";

interface Props {
  testId: string;
  readOnly?: boolean;
}

export function SchedulesPanel({ testId, readOnly = false }: Props) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // New schedule form
  const [showForm, setShowForm] = useState(false);
  const [cronExpr, setCronExpr] = useState("");
  const [adding, setAdding] = useState(false);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api.schedules.list({ test_id: testId });
      setSchedules(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [testId]);

  async function handleAdd() {
    if (!cronExpr) return;
    setAdding(true);
    setError(null);
    try {
      await api.schedules.create({ test_id: testId, cron_expr: cronExpr });
      setShowForm(false);
      setCronExpr("");
      flashSaved();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(sched: any) {
    try {
      await api.schedules.patch(sched.id, { enabled: sched.enabled ? 0 : 1 });
      flashSaved();
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.schedules.delete(id);
      flashSaved();
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-slate-300">Schedules</span>
        <span className={`text-xs transition-opacity duration-300 ${saved ? "text-success opacity-100" : "text-muted opacity-60"}`}>
          {saved ? "Saved" : "auto-saves"}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {error && <div className="text-red-400 text-xs">{error}</div>}

        {loading ? (
          <div className="text-muted text-xs">Loading...</div>
        ) : (
          <>
            {/* Schedule list */}
            {schedules.length === 0 && !showForm ? (
              <div className="text-muted text-xs">No schedules configured for this test.</div>
            ) : (
              <ul className="space-y-2">
                {schedules.map((sched) => (
                  <li key={sched.id} className="flex items-center gap-3 bg-bg-elevated rounded px-3 py-2.5">
                    <Clock size={13} className={sched.enabled ? "text-accent-bright shrink-0" : "text-muted shrink-0"} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-200">{cronToHuman(sched.cron_expr)}</span>
                        {!sched.enabled && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/40 text-muted">
                            disabled
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {sched.next_run_at
                          ? <>Next run: {format(sched.next_run_at, "MMM d, yyyy HH:mm")}</>
                          : "Not scheduled"}
                        {sched.last_run_at && (
                          <> · Last run: {format(sched.last_run_at, "MMM d, yyyy HH:mm")}</>
                        )}
                      </div>
                    </div>
                    {!readOnly && (
                      <>
                        <button
                          onClick={() => handleToggle(sched)}
                          title={sched.enabled ? "Disable" : "Enable"}
                          className={`transition-colors shrink-0 ${sched.enabled ? "text-accent-bright hover:text-muted" : "text-muted hover:text-accent-bright"}`}
                        >
                          <Power size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(sched.id)}
                          className="text-muted hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Add schedule */}
            {!readOnly && (
              <div className="pt-1 border-t border-border space-y-3">
                {!showForm ? (
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 text-xs text-muted hover:text-slate-200 transition-colors"
                  >
                    <Plus size={12} />
                    Add schedule
                  </button>
                ) : (
                  <>
                    <ScheduleBuilder onChange={setCronExpr} />
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={handleAdd} disabled={adding || !cronExpr}>
                        <Plus size={13} />
                        {adding ? "Adding..." : "Add"}
                      </Button>
                      <button
                        onClick={() => { setShowForm(false); setCronExpr(""); }}
                        className="text-xs text-muted hover:text-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

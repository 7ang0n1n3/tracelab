// /frontend/src/app/runs/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { api } from "@/lib/api";
import type { Run, Test } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RefreshCw, Trash2 } from "lucide-react";

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [tests, setTests] = useState<Record<string, Test>>({});
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const headerCheckRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setSelected(new Set());
    try {
      const [r, t] = await Promise.all([api.runs.list({ limit: "100" }), api.tests.list()]);
      setRuns(r);
      setTests(Object.fromEntries(t.map((x) => [x.id, x])));
    } catch {
      // errors surface via empty state — runs/tests remain at prior value
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!headerCheckRef.current || runs.length === 0) return;
    const allSelected = runs.every((r) => selected.has(r.id));
    const someSelected = runs.some((r) => selected.has(r.id));
    headerCheckRef.current.checked = allSelected;
    headerCheckRef.current.indeterminate = someSelected && !allSelected;
  }, [selected, runs]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allSelected = runs.every((r) => selected.has(r.id));
    setSelected(allSelected ? new Set() : new Set(runs.map((r) => r.id)));
  }

  async function handleDelete(id: string) {
    setConfirm({
      message: "Delete this run and its artifacts?",
      onConfirm: async () => {
        setConfirm(null);
        await api.runs.delete(id);
        load();
      },
    });
  }

  function handleBulkDelete() {
    const count = selected.size;
    setConfirm({
      message: `Delete ${count} selected run${count !== 1 ? "s" : ""} and their artifacts?`,
      onConfirm: async () => {
        setConfirm(null);
        await api.runs.bulkDelete(Array.from(selected));
        load();
      },
    });
  }

  return (
    <div className="space-y-5">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Runs</h1>
          <p className="text-sm text-muted mt-0.5">{runs.length} total runs</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw size={13} />
          Refresh
        </Button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-accent/10 border border-accent/30 rounded-lg">
          <span className="text-sm text-accent-bright font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={handleBulkDelete} className="text-red-400 hover:text-red-300">
              <Trash2 size={11} />
              Delete
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-muted hover:text-slate-300 transition-colors ml-1"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-muted text-sm">Loading...</div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">No runs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="px-4 py-2 w-8">
                  <input
                    ref={headerCheckRef}
                    type="checkbox"
                    onChange={toggleSelectAll}
                    className="accent-accent cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-2">Test</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Duration</th>
                <th className="text-left px-4 py-2">Started</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className={`border-b border-border/50 hover:bg-bg-elevated transition-colors ${
                    selected.has(run.id) ? "bg-accent/5" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={selected.has(run.id)}
                      onChange={() => toggleSelect(run.id)}
                      className="accent-accent cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">
                    <div className="flex items-center gap-2">
                      {tests[run.test_id]?.name ?? <span className="text-muted italic">Deleted</span>}
                      {run.attempt > 1 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/40 border border-yellow-700/40 text-yellow-400 font-mono">
                          ↺ {run.attempt}
                        </span>
                      )}
                      {run.triggered_by_run_id && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/40 border border-purple-700/40 text-purple-400 font-mono">
                          ⛓ chain
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={run.status} /></td>
                  <td className="px-4 py-2.5 text-muted font-mono text-xs">
                    {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted text-xs">
                    {run.started_at ? formatDistanceToNow(run.started_at, { addSuffix: true }) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted text-xs">
                    {run.created_at ? format(run.created_at, "MMM d, HH:mm") : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 justify-end">
                      <Link href={`/runs/${run.id}`} className="text-xs text-accent-bright hover:underline">
                        View →
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(run.id)}>
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

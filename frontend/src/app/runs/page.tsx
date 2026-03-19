"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RefreshCw, Trash2 } from "lucide-react";

export default function RunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [tests, setTests] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([api.runs.list({ limit: "100" }), api.tests.list()]);
      setRuns(r);
      setTests(Object.fromEntries(t.map((x: any) => [x.id, x])));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

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

      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-muted text-sm">Loading...</div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">No runs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
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
                <tr key={run.id} className="border-b border-border/50 hover:bg-bg-elevated transition-colors">
                  <td className="px-4 py-2.5 text-slate-300">
                    {tests[run.test_id]?.name ?? <span className="text-muted italic">Deleted</span>}
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

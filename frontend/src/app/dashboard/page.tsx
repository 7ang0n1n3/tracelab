"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import type { Run, Test } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Plus, RefreshCw } from "lucide-react";

export default function DashboardPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([api.runs.list({ limit: "20" }), api.tests.list()]);
      setRuns(r);
      setTests(t);
    } catch {
      // errors leave stats at zero — user can retry via Refresh
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const passed = runs.filter((r) => r.status === "passed").length;
  const failed = runs.filter((r) => r.status === "failed" || r.status === "error").length;
  const passRate = runs.length > 0 ? Math.round((passed / runs.length) * 100) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Dashboard</h1>
          <p className="text-sm text-muted mt-0.5">Overview of recent test activity</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw size={13} />
            Refresh
          </Button>
          <Link href="/tests/new">
            <Button variant="primary" size="sm">
              <Plus size={13} />
              New Test
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Tests", value: tests.length },
          { label: "Recent Runs", value: runs.length },
          { label: "Passed", value: passed, color: "text-success" },
          { label: "Pass Rate", value: passRate !== null ? `${passRate}%` : "—", color: passRate !== null && passRate >= 80 ? "text-success" : "text-danger" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-bg-surface border border-border rounded-lg p-4">
            <div className="text-xs text-muted mb-1">{label}</div>
            <div className={`text-2xl font-semibold font-mono ${color ?? "text-slate-100"}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Recent runs */}
      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-medium text-slate-300">
          Recent Runs
        </div>
        {loading ? (
          <div className="p-6 text-center text-muted text-sm">Loading...</div>
        ) : runs.length === 0 ? (
          <div className="p-6 text-center text-muted text-sm">
            No runs yet.{" "}
            <Link href="/tests" className="text-accent-bright hover:underline">
              Run a test
            </Link>{" "}
            to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left px-4 py-2">Test</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Duration</th>
                <th className="text-left px-4 py-2">Started</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const test = tests.find((t) => t.id === run.test_id);
                return (
                  <tr key={run.id} className="border-b border-border/50 hover:bg-bg-elevated transition-colors">
                    <td className="px-4 py-2.5 text-slate-300">
                      {test?.name ?? <span className="text-muted">Deleted test</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-2.5 text-muted font-mono text-xs">
                      {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted text-xs">
                      {run.started_at
                        ? formatDistanceToNow(run.started_at, { addSuffix: true })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/runs/${run.id}`}
                        className="text-xs text-accent-bright hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

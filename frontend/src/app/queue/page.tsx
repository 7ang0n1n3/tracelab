// /frontend/src/app/queue/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";

const POLL_INTERVAL_MS = 2000;

function useElapsed(baseMs: number | null): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  if (!baseMs) return "—";
  const ms = now - baseMs;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function ElapsedCell({ run }: { run: any }) {
  const base = run.status === "running" ? run.started_at : run.created_at;
  const elapsed = useElapsed(base);
  const label = run.status === "running" ? "Running" : "Waiting";
  return (
    <span className="text-xs font-mono text-muted">
      {label} {elapsed}
    </span>
  );
}

export default function QueuePage() {
  const [active, setActive] = useState<any[]>([]);
  const [tests, setTests] = useState<Record<string, any>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    try {
      const [runs, testList] = await Promise.all([
        api.runs.list({ status: "pending,running", limit: "200" }),
        api.tests.list(),
      ]);
      setActive(runs.sort((a: any, b: any) => a.created_at - b.created_at));
      setTests(Object.fromEntries(testList.map((t: any) => [t.id, t])));
      setLastUpdated(new Date());
    } catch {
      // silently ignore — next poll will retry
    }
  }

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const pending = active.filter((r) => r.status === "pending");
  const running = active.filter((r) => r.status === "running");

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-100">Run Queue</h1>
            <span className="inline-flex items-center gap-1.5 text-xs text-blue-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Live
            </span>
          </div>
          {lastUpdated && (
            <p className="text-xs text-muted mt-0.5">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Counters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-muted text-xs">{running.length} running</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            <span className="text-muted text-xs">{pending.length} pending</span>
          </div>
        </div>
      </div>

      {/* Queue table */}
      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        {active.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-2.5 h-2.5 rounded-full bg-success" />
            <p className="text-sm text-muted">Queue is clear — no pending or running runs.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left px-4 py-2.5">Test</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Elapsed</th>
                <th className="text-left px-4 py-2.5">Attempt</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {active.map((run) => (
                <tr key={run.id} className="border-b border-border/50 hover:bg-bg-elevated transition-colors">
                  <td className="px-4 py-3 text-slate-300 max-w-xs truncate">
                    {tests[run.test_id]?.name ?? (
                      <span className="text-muted italic">Deleted test</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3">
                    <ElapsedCell run={run} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {run.attempt > 1 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/40 border border-yellow-700/40 text-yellow-400 font-mono">
                          ↺ {run.attempt}
                        </span>
                      )}
                      {run.triggered_by_run_id && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/40 border border-purple-700/40 text-purple-400 font-mono">
                          ⛓
                        </span>
                      )}
                      {run.attempt <= 1 && !run.triggered_by_run_id && (
                        <span className="text-xs text-muted font-mono">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/runs/${run.id}`}
                      className="text-xs text-accent-bright hover:underline"
                    >
                      View →
                    </Link>
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

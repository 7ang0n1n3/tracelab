"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Plus, Play, Copy, Trash2, Search } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const t = await api.tests.list(search ? { search } : undefined);
      setTests(t);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search]);

  async function handleRun(id: string) {
    setRunning(id);
    try {
      const { runId } = await api.tests.run(id);
      router.push(`/runs/${runId}`);
    } catch (e: any) {
      alert(e.message);
      setRunning(null);
    }
  }

  async function handleDuplicate(id: string) {
    await api.tests.duplicate(id);
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    await api.tests.delete(id);
    load();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Tests</h1>
          <p className="text-sm text-muted mt-0.5">{tests.length} test{tests.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/tests/new">
          <Button variant="primary" size="sm">
            <Plus size={13} />
            New Test
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tests..."
          className="w-full bg-bg-surface border border-border rounded px-3 py-2 pl-8 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* List */}
      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-muted text-sm">Loading...</div>
        ) : tests.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">
            {search ? "No tests match your search." : "No tests yet. Create one to get started."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">App</th>
                <th className="text-left px-4 py-2">Base URL</th>
                <th className="text-left px-4 py-2">Updated</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr key={test.id} className="border-b border-border/50 hover:bg-bg-elevated transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/tests/${test.id}`} className="text-accent-bright hover:underline font-medium">
                      {test.name}
                    </Link>
                    {test.description && (
                      <div className="text-xs text-muted mt-0.5 truncate max-w-xs">{test.description}</div>
                    )}
                    {test.tags && (() => {
                      try {
                        const tagList: string[] = JSON.parse(test.tags);
                        return tagList.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tagList.map((tag) => (
                              <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent-bright border border-accent/20">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null;
                      } catch { return null; }
                    })()}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{test.app_name || "—"}</td>
                  <td className="px-4 py-3 text-muted text-xs truncate max-w-[200px]">{test.base_url || "—"}</td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {formatDistanceToNow(test.updated_at, { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleRun(test.id)}
                        disabled={running === test.id}
                      >
                        <Play size={11} />
                        {running === test.id ? "Starting..." : "Run"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDuplicate(test.id)}>
                        <Copy size={11} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(test.id, test.name)}>
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

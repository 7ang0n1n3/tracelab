// /frontend/src/app/tests/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import type { Test } from "@/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Plus, Play, Copy, Trash2, Search, Tag } from "lucide-react";
import { useRouter } from "next/navigation";

type TagMode = "add" | "remove" | "set";

export default function TestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagModal, setTagModal] = useState<{ tags: string; mode: TagMode } | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const headerCheckRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setSelected(new Set());
    try {
      const t = await api.tests.list(search ? { search } : undefined);
      setTests(t);
    } catch {
      // errors leave list empty — user can retry via search change
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search]);

  useEffect(() => {
    if (!headerCheckRef.current || tests.length === 0) return;
    const allSelected = tests.every((t) => selected.has(t.id));
    const someSelected = tests.some((t) => selected.has(t.id));
    headerCheckRef.current.checked = allSelected;
    headerCheckRef.current.indeterminate = someSelected && !allSelected;
  }, [selected, tests]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allSelected = tests.every((t) => selected.has(t.id));
    setSelected(allSelected ? new Set() : new Set(tests.map((t) => t.id)));
  }

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

  function handleDelete(id: string, name: string) {
    setConfirm({
      message: `Delete "${name}"?`,
      onConfirm: async () => {
        setConfirm(null);
        await api.tests.delete(id);
        load();
      },
    });
  }

  function handleBulkDelete() {
    const count = selected.size;
    setConfirm({
      message: `Delete ${count} selected test${count !== 1 ? "s" : ""}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null);
        await api.tests.bulkDelete(Array.from(selected));
        load();
      },
    });
  }

  async function handleBulkRun() {
    setBulkRunning(true);
    try {
      await api.tests.bulkRun(Array.from(selected));
      router.push("/runs");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBulkRunning(false);
    }
  }

  async function handleBulkTag() {
    if (!tagModal) return;
    const tags = tagModal.tags.split(",").map((t) => t.trim()).filter(Boolean);
    await api.tests.bulkTag(Array.from(selected), tags, tagModal.mode);
    setTagModal(null);
    load();
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

      {tagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-surface border border-border rounded-lg p-6 w-96 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">
              Tag {selected.size} test{selected.size !== 1 ? "s" : ""}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Tags (comma-separated)</label>
                <input
                  value={tagModal.tags}
                  onChange={(e) => setTagModal({ ...tagModal, tags: e.target.value })}
                  placeholder="smoke, regression, nightly"
                  className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Mode</label>
                <div className="flex gap-2">
                  {(["add", "remove", "set"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTagModal({ ...tagModal, mode: m })}
                      className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                        tagModal.mode === m
                          ? "bg-accent/20 border-accent text-accent-bright"
                          : "border-border text-muted hover:border-accent/50"
                      }`}
                    >
                      {m === "add" ? "Add" : m === "remove" ? "Remove" : "Replace"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setTagModal(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleBulkTag}>Apply</Button>
            </div>
          </div>
        </div>
      )}

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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-accent/10 border border-accent/30 rounded-lg">
          <span className="text-sm text-accent-bright font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={handleBulkRun} disabled={bulkRunning}>
              <Play size={11} />
              {bulkRunning ? "Queuing..." : "Run All"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setTagModal({ tags: "", mode: "add" })}>
              <Tag size={11} />
              Tag
            </Button>
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
                <th className="px-4 py-2 w-8">
                  <input
                    ref={headerCheckRef}
                    type="checkbox"
                    onChange={toggleSelectAll}
                    className="accent-accent cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">App</th>
                <th className="text-left px-4 py-2">Base URL</th>
                <th className="text-left px-4 py-2">Updated</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr
                  key={test.id}
                  className={`border-b border-border/50 hover:bg-bg-elevated transition-colors ${
                    selected.has(test.id) ? "bg-accent/5" : ""
                  }`}
                >
                  <td className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.has(test.id)}
                      onChange={() => toggleSelect(test.id)}
                      className="accent-accent cursor-pointer"
                    />
                  </td>
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

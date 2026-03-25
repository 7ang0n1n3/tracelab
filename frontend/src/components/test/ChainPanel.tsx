// /frontend/src/components/test/ChainPanel.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { OutgoingChainLink, IncomingChainLink, Test } from "@/types";
import { Button } from "@/components/ui/Button";
import { Trash2, Plus, ArrowRight, ArrowLeft } from "lucide-react";

interface Props {
  testId: string;
  readOnly?: boolean;
}

export function ChainPanel({ testId, readOnly = false }: Props) {
  const [outgoing, setOutgoing] = useState<OutgoingChainLink[]>([]);
  const [incoming, setIncoming] = useState<IncomingChainLink[]>([]);
  const [allTests, setAllTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [continueOnFailure, setContinueOnFailure] = useState(false);
  const [adding, setAdding] = useState(false);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function load() {
    setLoading(true);
    try {
      const [chain, tests] = await Promise.all([
        api.chain.get(testId),
        api.tests.list(),
      ]);
      setOutgoing(chain.outgoing);
      setIncoming(chain.incoming);
      // Exclude self and tests already linked outgoing
      const linkedIds = new Set(chain.outgoing.map((l) => l.to_test_id));
      linkedIds.add(testId);
      setAllTests(tests.filter((t) => !linkedIds.has(t.id)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [testId]);

  async function handleAdd() {
    if (!selectedTestId) return;
    setAdding(true);
    setError(null);
    try {
      await api.chain.add({
        from_test_id: testId,
        to_test_id: selectedTestId,
        continue_on_failure: continueOnFailure ? 1 : 0,
      });
      setSelectedTestId("");
      setContinueOnFailure(false);
      flashSaved();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleContinue(link: OutgoingChainLink) {
    try {
      await api.chain.patch(link.id, { continue_on_failure: link.continue_on_failure ? 0 : 1 });
      flashSaved();
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleRemove(linkId: string) {
    try {
      await api.chain.remove(linkId);
      flashSaved();
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const selectClass = "bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-accent";

  return (
    <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-slate-300">Dependency Chain</span>
        <span className={`text-xs transition-opacity duration-300 ${saved ? "text-success opacity-100" : "text-muted opacity-60"}`}>
          {saved ? "Saved" : "auto-saves"}
        </span>
      </div>

      <div className="p-4 space-y-5">
        {error && <div className="text-red-400 text-xs">{error}</div>}
        {loading ? (
          <div className="text-muted text-xs">Loading...</div>
        ) : (
          <>
            {/* Incoming — which tests trigger this one */}
            {incoming.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted mb-2">
                  <ArrowLeft size={11} />
                  Triggered by (these tests run before this one)
                </div>
                <ul className="space-y-1.5">
                  {incoming.map((link) => (
                    <li key={link.id} className="flex items-center gap-2 bg-bg-elevated rounded px-3 py-2 text-sm">
                      <Link href={`/tests/${link.from_test_id}`} className="text-accent-bright hover:underline truncate flex-1">
                        {link.from_test_name}
                      </Link>
                      {link.continue_on_failure === 1 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/30 border border-yellow-700/30 text-yellow-400 shrink-0">
                          runs even on failure
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Outgoing — which tests run after this one */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted mb-2">
                <ArrowRight size={11} />
                Then run (these tests run after this one)
              </div>
              {outgoing.length === 0 ? (
                <div className="text-muted text-xs">No tests chained after this one.</div>
              ) : (
                <ul className="space-y-1.5">
                  {outgoing.map((link) => (
                    <li key={link.id} className="flex items-center gap-2 bg-bg-elevated rounded px-3 py-2 text-sm">
                      <Link href={`/tests/${link.to_test_id}`} className="text-accent-bright hover:underline truncate flex-1">
                        {link.to_test_name}
                      </Link>
                      {!readOnly && (
                        <button
                          onClick={() => handleToggleContinue(link)}
                          title={link.continue_on_failure ? "Click to stop chain on failure" : "Click to continue chain even on failure"}
                          className={`text-xs px-1.5 py-0.5 rounded border transition-colors shrink-0 ${
                            link.continue_on_failure
                              ? "bg-yellow-900/30 border-yellow-700/30 text-yellow-400 hover:bg-yellow-900/50"
                              : "bg-zinc-800 border-zinc-700/40 text-muted hover:text-slate-300"
                          }`}
                        >
                          {link.continue_on_failure ? "runs even on failure" : "stops on failure"}
                        </button>
                      )}
                      {readOnly && link.continue_on_failure === 1 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/30 border border-yellow-700/30 text-yellow-400 shrink-0">
                          runs even on failure
                        </span>
                      )}
                      {!readOnly && (
                        <button
                          onClick={() => handleRemove(link.id)}
                          className="text-muted hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Add outgoing link */}
            {!readOnly && (
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
                <select
                  value={selectedTestId}
                  onChange={(e) => setSelectedTestId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— Select next test —</option>
                  {allTests.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={continueOnFailure}
                    onChange={(e) => setContinueOnFailure(e.target.checked)}
                    className="accent-accent"
                  />
                  Continue chain even on failure
                </label>

                <Button variant="ghost" size="sm" onClick={handleAdd} disabled={adding || !selectedTestId}>
                  <Plus size={13} />
                  {adding ? "Adding..." : "Add"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

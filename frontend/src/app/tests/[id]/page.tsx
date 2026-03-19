"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RecorderPanel } from "@/components/recorder/RecorderPanel";
import { ArrowLeft, Play, Save, Trash2, Copy } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { SharesPanel } from "@/components/test/SharesPanel";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function TestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const [test, setTest] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [authStates, setAuthStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [appName, setAppName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [tags, setTags] = useState("");
  const [script, setScript] = useState("");
  const [authStateId, setAuthStateId] = useState("");
  const [useAuth, setUseAuth] = useState(true);
  const [browser, setBrowser] = useState<string>("");
  const [captureVideo, setCaptureVideo] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const [t, r, a] = await Promise.all([
        api.tests.get(id),
        api.runs.list({ test_id: id, limit: "10" }),
        api.authStates.list(),
      ]);
      setTest(t);
      setRuns(r);
      setAuthStates(a);
      setName(t.name);
      setDescription(t.description ?? "");
      setAppName(t.app_name ?? "");
      setBaseUrl(t.base_url ?? "");
      setScript(t.script);
      setAuthStateId(t.auth_state_id ?? "");
      setUseAuth(t.use_auth === 1);
      setBrowser(t.browser ?? "");
      setCaptureVideo(t.capture_video === null || t.capture_video === undefined ? "" : t.capture_video === 1 ? "true" : "false");
      // Parse tags from JSON array to comma string
      try {
        const parsed = JSON.parse(t.tags || "[]");
        setTags(Array.isArray(parsed) ? parsed.join(", ") : "");
      } catch {
        setTags("");
      }
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      await api.tests.update(id, {
        name, description, app_name: appName, base_url: baseUrl,
        script, auth_state_id: authStateId || null, use_auth: useAuth ? 1 : 0,
        tags: tagList.length ? JSON.stringify(tagList) : null,
        browser: browser || null,
        capture_video: captureVideo === "" ? null : captureVideo === "true" ? 1 : 0,
      });
      setDirty(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    try {
      const { runId } = await api.tests.run(id);
      router.push(`/runs/${runId}`);
    } catch (e: any) {
      alert(e.message);
      setRunning(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${name}"? This will also delete all run history.`)) return;
    await api.tests.delete(id);
    router.push("/tests");
  }

  const markDirty = () => setDirty(true);

  if (loading) return <div className="text-muted text-sm">Loading...</div>;
  if (!test) return <div className="text-muted text-sm">Test not found.</div>;

  const access = test._access as string;
  const isReadOnly = access === "read";
  const canShare = access === "owner" || access === "admin";
  const canDelete = access === "owner" || access === "admin";

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/tests"><Button variant="ghost" size="sm"><ArrowLeft size={13} /></Button></Link>
          <h1 className="text-xl font-semibold text-slate-100">{name || "Untitled"}</h1>
          {dirty && <span className="text-xs text-warning px-1.5 py-0.5 bg-yellow-900/30 border border-yellow-700/30 rounded">Unsaved</span>}
        </div>
        <div className="flex items-center gap-2">
          {isReadOnly && (
            <span className="text-xs text-muted px-2 py-0.5 bg-zinc-800 border border-zinc-700/40 rounded">
              read-only
            </span>
          )}
          {dirty && !isReadOnly && (
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              <Save size={13} />
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={handleRun} disabled={running}>
            <Play size={13} />
            {running ? "Starting..." : "Run"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => api.tests.duplicate(id).then(load)}>
            <Copy size={13} />
          </Button>
          {canDelete && (
            <Button variant="danger" size="sm" onClick={handleDelete}>
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/40 text-red-400 text-sm px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Metadata */}
      <div className="bg-bg-surface border border-border rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Test Name</label>
            <input value={name} onChange={(e) => { setName(e.target.value); markDirty(); }}
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">App / System</label>
            <input value={appName} onChange={(e) => { setAppName(e.target.value); markDirty(); }}
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Base URL</label>
            <input value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); markDirty(); }}
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Tags <span className="text-muted/60">(comma-separated)</span></label>
            <input value={tags} onChange={(e) => { setTags(e.target.value); markDirty(); }}
              placeholder="smoke, login, auth"
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Browser <span className="text-muted/60">(overrides system default)</span></label>
            <select value={browser} onChange={(e) => { setBrowser(e.target.value); markDirty(); }}
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent">
              <option value="">System default</option>
              <option value="chromium">Chromium</option>
              <option value="firefox">Firefox</option>
              <option value="webkit">WebKit (Safari)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Record Video <span className="text-muted/60">(overrides system default)</span></label>
            <select value={captureVideo} onChange={(e) => { setCaptureVideo(e.target.value); markDirty(); }}
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent">
              <option value="">System default</option>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Description</label>
          <textarea value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} rows={2}
            className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent resize-none" />
        </div>

        {/* Auth state */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={useAuth} onChange={(e) => { setUseAuth(e.target.checked); markDirty(); }}
              className="accent-accent" />
            Use Auth State
          </label>
          {useAuth && (
            <select value={authStateId} onChange={(e) => { setAuthStateId(e.target.value); markDirty(); }}
              className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-accent">
              <option value="">— None —</option>
              {authStates.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}{a.app_name ? ` (${a.app_name})` : ""}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Recorder */}
      {!isReadOnly && (
        <RecorderPanel
          defaultUrl={baseUrl}
          onScript={(s) => { setScript(s); markDirty(); }}
        />
      )}

      {/* Script editor */}
      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border text-xs text-muted flex items-center justify-between">
          <span>Playwright Script</span>
          <span className="text-yellow-700">No import/require — bare async code only</span>
        </div>
        <MonacoEditor
          height="420px"
          language="javascript"
          value={script}
          onChange={(v) => { if (!isReadOnly) { setScript(v ?? ""); markDirty(); } }}
          theme={theme === "dark" ? "vs-dark" : "vs"}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "JetBrains Mono, Fira Code, monospace",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            padding: { top: 12 },
            readOnly: isReadOnly,
          }}
        />
      </div>

      {/* Sharing */}
      {canShare && <SharesPanel testId={id} />}

      {/* Run history */}
      {runs.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-medium text-slate-300">
            Recent Runs
          </div>
          <table className="w-full text-sm">
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-border/50 hover:bg-bg-elevated transition-colors">
                  <td className="px-4 py-2.5"><StatusBadge status={run.status} /></td>
                  <td className="px-4 py-2.5 text-muted text-xs font-mono">
                    {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted text-xs">
                    {run.started_at ? formatDistanceToNow(run.started_at, { addSuffix: true }) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/runs/${run.id}`} className="text-xs text-accent-bright hover:underline">
                      View →
                    </Link>
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

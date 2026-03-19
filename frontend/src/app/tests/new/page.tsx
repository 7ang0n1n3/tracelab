"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { RecorderPanel } from "@/components/recorder/RecorderPanel";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/context/ThemeContext";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const DEFAULT_SCRIPT = `// TraceLab test script
// Write plain async Playwright code. Do NOT use import/require statements.
// Available globals: page, context, browser, takeScreenshot(label?), log(msg)

await page.goto('https://example.com');
await takeScreenshot('home');
`;

export default function NewTestPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [appName, setAppName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [tags, setTags] = useState("");
  const [browser, setBrowser] = useState<string>("");
  const [captureVideo, setCaptureVideo] = useState<string>("");
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) { setError("Test name is required."); return; }
    setSaving(true);
    setError(null);
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      const test = await api.tests.create({
        name, description, app_name: appName, base_url: baseUrl, script,
        tags: tagList.length ? JSON.stringify(tagList) : null,
        browser: browser || null,
        capture_video: captureVideo === "" ? null : captureVideo === "true" ? 1 : 0,
      });
      router.push(`/tests/${test.id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/tests">
          <Button variant="ghost" size="sm"><ArrowLeft size={13} /></Button>
        </Link>
        <h1 className="text-xl font-semibold text-slate-100">New Test</h1>
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
            <label className="block text-xs text-muted mb-1">Test Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Login flow"
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">App / System</label>
            <input value={appName} onChange={(e) => setAppName(e.target.value)}
              placeholder="Grafana"
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Base URL</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://grafana.lab.local"
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Tags <span className="text-muted/60">(comma-separated)</span></label>
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="smoke, login, auth"
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Browser <span className="text-muted/60">(overrides system default)</span></label>
            <select value={browser} onChange={(e) => setBrowser(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent">
              <option value="">System default</option>
              <option value="chromium">Chromium</option>
              <option value="firefox">Firefox</option>
              <option value="webkit">WebKit (Safari)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Record Video <span className="text-muted/60">(overrides system default)</span></label>
            <select value={captureVideo} onChange={(e) => setCaptureVideo(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent">
              <option value="">System default</option>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            placeholder="What does this test verify?"
            className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent resize-none" />
        </div>
      </div>

      {/* Recorder */}
      <RecorderPanel defaultUrl={baseUrl} onScript={(s) => setScript(s)} />

      {/* Script editor */}
      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border text-xs text-muted flex items-center justify-between">
          <span>Playwright Script</span>
          <span className="text-yellow-700">No import/require — bare async code only</span>
        </div>
        <MonacoEditor
          height="400px"
          language="javascript"
          value={script}
          onChange={(v) => setScript(v ?? "")}
          theme={theme === "dark" ? "vs-dark" : "vs"}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "JetBrains Mono, Fira Code, monospace",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            padding: { top: 12 },
          }}
        />
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          <Save size={13} />
          {saving ? "Saving..." : "Save Test"}
        </Button>
      </div>
    </div>
  );
}

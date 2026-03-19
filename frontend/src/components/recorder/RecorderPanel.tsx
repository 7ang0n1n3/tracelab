"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Video, CheckCircle, X } from "lucide-react";

interface RecorderPanelProps {
  defaultUrl?: string;
  onScript: (script: string) => void;
}

type Phase = "idle" | "recording" | "finishing";

export function RecorderPanel({ defaultUrl = "", onScript }: RecorderPanelProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(defaultUrl);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [vncUrl, setVncUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setError(null);
    setPhase("recording");
    try {
      const res = await api.codegen.start({ url: url || undefined });
      setSessionId(res.sessionId);
      const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
      setVncUrl(`http://${host}:${res.vncPort}/vnc.html?autoconnect=1&resize=scale&show_dot=true`);
    } catch (e: any) {
      setError(e.message);
      setPhase("idle");
    }
  }

  async function handleFinish() {
    if (!sessionId) return;
    setPhase("finishing");
    setError(null);
    try {
      const res = await api.codegen.finish(sessionId);
      onScript(res.script);
      setPhase("idle");
      setSessionId(null);
      setVncUrl(null);
      setOpen(false);
    } catch (e: any) {
      setError(e.message);
      setPhase("idle");
    }
  }

  function handleCancel() {
    if (sessionId) {
      api.codegen.finish(sessionId).catch(() => {});
    }
    setPhase("idle");
    setSessionId(null);
    setVncUrl(null);
    setOpen(false);
    setError(null);
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Video size={13} />
        Record Script
      </Button>
    );
  }

  // Recording modal — full-screen overlay with embedded noVNC browser
  if (phase === "recording" || phase === "finishing") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-bg-base">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-surface shrink-0">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-sm font-medium text-slate-200">
              {phase === "finishing" ? "Saving recording..." : "Recording — interact with the browser below"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {phase === "recording" && (
              <Button variant="primary" size="sm" onClick={handleFinish}>
                <CheckCircle size={13} />
                Finish &amp; Import Script
              </Button>
            )}
            <button onClick={handleCancel} className="text-muted hover:text-slate-300 transition-colors p-1">
              <X size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="px-5 py-2 text-xs text-red-400 bg-red-900/20 border-b border-red-700/30 shrink-0">
            {error}
          </div>
        )}

        {/* noVNC iframe — fills remaining space */}
        {vncUrl && phase === "recording" && (
          <iframe
            src={vncUrl}
            className="flex-1 w-full border-0"
            allow="fullscreen"
          />
        )}

        {phase === "finishing" && (
          <div className="flex-1 flex items-center justify-center text-muted text-sm">
            Capturing recorded script...
          </div>
        )}
      </div>
    );
  }

  // Idle panel — URL input + start button
  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">Record a script</span>
        <button onClick={handleCancel} className="text-muted hover:text-slate-300 transition-colors">
          <X size={14} />
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs text-muted mb-1">Starting URL (optional)</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-app.local"
          className="w-full bg-bg-surface border border-border rounded px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={handleStart}>
          <Video size={13} />
          Open Browser
        </Button>
      </div>
      <p className="text-xs text-muted">
        A live browser will open inside TraceLab. Interact with your app to record actions, then click Finish.
      </p>
    </div>
  );
}

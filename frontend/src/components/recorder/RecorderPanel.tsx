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
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setError(null);
    setPhase("recording");
    try {
      const res = await api.codegen.start({ url: url || undefined });
      setSessionId(res.sessionId);
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
      setOpen(false);
    } catch (e: any) {
      setError(e.message);
      setPhase("idle");
    }
  }

  function handleCancel() {
    // Best-effort: attempt to finish with an empty result
    if (sessionId) {
      api.codegen.finish(sessionId).catch(() => {});
    }
    setPhase("idle");
    setSessionId(null);
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

  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">
          {phase === "idle" ? "Record a script" : "Recording in progress"}
        </span>
        <button onClick={handleCancel} className="text-muted hover:text-slate-300 transition-colors">
          <X size={14} />
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {phase === "idle" && (
        <>
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
            A browser window will open on the runner host. Interact with it, then click Finish to import the recorded script.
          </p>
        </>
      )}

      {phase === "recording" && (
        <>
          <div className="flex items-center gap-2 text-sm text-blue-300">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
            Browser is open — interact with your app to record actions.
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={handleFinish}>
              <CheckCircle size={13} />
              Finish &amp; Import Script
            </Button>
          </div>
        </>
      )}

      {phase === "finishing" && (
        <div className="text-sm text-muted text-center py-2">Saving recording...</div>
      )}
    </div>
  );
}

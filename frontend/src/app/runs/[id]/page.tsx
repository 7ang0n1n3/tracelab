"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, RefreshCw, Image as ImageIcon, Video, Download, PackageOpen } from "lucide-react";

const TERMINAL_STATUSES = new Set(["passed", "failed", "error"]);

// Degrees per ms for each ring
const OUTER_DEG_PER_MS = 360 / 1400;
const INNER_DEG_PER_MS = 360 / 3000;

function RunningOverlay({ elapsed }: { elapsed: number }) {
  const outerRef = useRef<SVGCircleElement>(null);
  const innerRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let outerAngle = 0;
    let innerAngle = 0;
    let lastTime: number | null = null;
    let raf: number;

    const tick = (now: number) => {
      if (lastTime !== null) {
        const delta = now - lastTime;
        outerAngle = (outerAngle + OUTER_DEG_PER_MS * delta) % 360;
        innerAngle = (innerAngle - INNER_DEG_PER_MS * delta + 360) % 360;
      }
      lastTime = now;
      outerRef.current?.setAttribute("transform", `rotate(${outerAngle} 60 60)`);
      innerRef.current?.setAttribute("transform", `rotate(${innerAngle} 60 60)`);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const mm = String(Math.floor(elapsed / 60000)).padStart(2, "0");
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");
  const t  = String(Math.floor((elapsed % 1000) / 100));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-4">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Static glow ring */}
          <circle cx="60" cy="60" r="54" stroke="#a78bfa" strokeWidth="6" strokeOpacity="0.12" />

          {/* Inner dashes — rotated by RAF */}
          <circle
            ref={innerRef}
            cx="60" cy="60" r="44"
            stroke="#7c3aed"
            strokeWidth="1"
            strokeOpacity="0.35"
            strokeDasharray="8 12"
          />

          {/* Outer arc — rotated by RAF */}
          <circle
            ref={outerRef}
            cx="60" cy="60" r="54"
            stroke="url(#ringGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="60 279"
          />

          {/* Lightning bolt */}
          <path
            d="M66 28L44 62h18l-8 30 30-38H66l8-26z"
            fill="url(#boltGrad)"
            style={{ animation: "tl-pulse 1.2s ease-in-out infinite" }}
          />

          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
            <linearGradient id="boltGrad" x1="44" y1="28" x2="74" y2="92" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#e0d7ff" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
        </svg>

        <span className="text-xs text-muted tracking-widest uppercase" style={{ animation: "tl-pulse 1.2s ease-in-out infinite" }}>
          Running
        </span>

        <span className="text-lg font-mono text-accent-bright tabular-nums">
          {mm}:{ss}.{t}
        </span>
      </div>

      <style>{`
        @keyframes tl-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<any>(null);
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liveLog, setLiveLog] = useState<string>("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [videos, setVideos] = useState<{ name: string; url: string }[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const logRef = useRef<HTMLPreElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const startedAtRef = useRef<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api.runs.get(id);
      setRun(r);
      if (r.test_id) {
        api.tests.get(r.test_id).then(setTest).catch(() => {});
      }
      api.artifacts.list(id).then(({ files }: { files: { name: string; url: string }[] }) => {
        setVideos(files.filter((f: { name: string; url: string }) =>
          f.name.endsWith(".webm") || f.name.endsWith(".mp4")
        ));
      }).catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  function connectSSE() {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(`/api/runs/${id}/logs`);
    esRef.current = es;

    es.onmessage = (event) => {
      if (event.data === "__done__") {
        es.close();
        esRef.current = null;
        api.runs.get(id).then(setRun).catch(() => {});
        api.artifacts.list(id).then(({ files }: { files: { name: string; url: string }[] }) => {
          setVideos(files.filter((f: { name: string; url: string }) => f.name.endsWith(".webm") || f.name.endsWith(".mp4")));
        }).catch(() => {});
        return;
      }
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.log) setLiveLog(parsed.log);
      } catch {
        // ignore non-JSON
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
    };
  }

  useEffect(() => {
    load().then(() => {
      api.runs.get(id).then((r) => {
        if (!TERMINAL_STATUSES.has(r.status)) connectSSE();
      });
    });
    return () => { esRef.current?.close(); };
  }, [id]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await api.runs.get(id);
        setRun(r);
        if (TERMINAL_STATUSES.has(r.status)) {
          clearInterval(interval);
          esRef.current?.close();
        }
      } catch {
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [liveLog, run?.log]);

  useEffect(() => {
    if (!run) return;
    if (TERMINAL_STATUSES.has(run.status)) {
      setElapsed(run.duration_ms ?? 0);
      return;
    }
    startedAtRef.current = run.started_at ?? Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - (startedAtRef.current ?? Date.now()));
    }, 100);
    return () => clearInterval(interval);
  }, [run?.status, run?.started_at]);

  if (loading) return <div className="text-muted text-sm">Loading...</div>;
  if (!run) return <div className="text-muted text-sm">Run not found.</div>;

  const isActive = !TERMINAL_STATUSES.has(run.status);
  const displayLog = liveLog || run.log || "";

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/runs"><Button variant="ghost" size="sm"><ArrowLeft size={13} /></Button></Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-100">{test?.name ?? "Run Detail"}</h1>
              <StatusBadge status={run.status} />
            </div>
            <p className="text-xs text-muted mt-0.5 font-mono">{id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isActive && (
            <a href={api.artifacts.exportUrl(id)} download>
              <Button variant="outline" size="sm">
                <PackageOpen size={13} className="mr-1.5" />
                Export ZIP
              </Button>
            </a>
          )}
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw size={13} /></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Status",   value: run.status },
          { label: "Duration", value: run.duration_ms ? `${(run.duration_ms / 1000).toFixed(2)}s` : isActive ? "Running…" : "—" },
          { label: "Started",  value: run.started_at  ? format(run.started_at,  "HH:mm:ss") : "—" },
          { label: "Finished", value: run.finished_at ? format(run.finished_at, "HH:mm:ss") : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-bg-surface border border-border rounded-lg p-3">
            <div className="text-xs text-muted mb-1">{label}</div>
            <div className="text-sm font-mono text-slate-200">{value}</div>
          </div>
        ))}
      </div>

      {/* Error */}
      {run.error_message && (
        <div className="bg-red-900/30 border border-red-700/40 text-red-400 text-sm px-4 py-3 rounded font-mono">
          {run.error_message}
        </div>
      )}

      {/* Log */}
      {displayLog && (
        <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-xs text-muted flex items-center justify-between">
            <span>Execution Log</span>
            {isActive && <span className="text-blue-400 animate-pulse text-xs">● Live</span>}
          </div>
          <pre ref={logRef} className="p-4 text-xs font-mono text-slate-300 overflow-auto max-h-80 whitespace-pre-wrap leading-relaxed">
            {displayLog}
          </pre>
        </div>
      )}

      {/* Screenshots */}
      {run.screenshots && run.screenshots.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-xs text-muted flex items-center gap-2">
            <ImageIcon size={12} />
            Screenshots ({run.screenshots.length})
          </div>
          <div className="p-4 grid grid-cols-3 gap-3">
            {run.screenshots.map((url: string) => {
              const name = url.split("/").pop() ?? url;
              return (
                <button key={url} onClick={() => setLightbox(url)} className="group relative">
                  <img src={url} alt={name} className="w-full rounded border border-border object-cover aspect-video bg-bg-elevated group-hover:border-accent transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-muted px-2 py-1 rounded-b truncate">{name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-xs text-muted flex items-center gap-2">
            <Video size={12} />
            Recording ({videos.length})
          </div>
          <div className="p-4 space-y-4">
            {videos.map((v) => (
              <div key={v.url}>
                <video src={v.url} controls className="w-full rounded border border-border bg-black" style={{ maxHeight: "480px" }} />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted font-mono truncate">{v.name}</span>
                  <a href={v.url} download={v.name} className="flex items-center gap-1 text-xs text-accent-bright hover:underline ml-4 shrink-0">
                    <Download size={11} />
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      {test && (
        <div className="flex gap-3">
          <Link href={`/tests/${run.test_id}`}>
            <Button variant="outline" size="sm">View Test →</Button>
          </Link>
        </div>
      )}

      {/* Live browser panel (headed mode via VNC) */}
      {isActive && run.vnc_port && (
        <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-xs text-muted flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Live Browser View
          </div>
          <iframe
            src={`http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:${run.vnc_port}/vnc.html?autoconnect=1&resize=scale&show_dot=true`}
            className="w-full border-0"
            style={{ height: "480px" }}
          />
        </div>
      )}

      {/* Running overlay */}
      {isActive && <RunningOverlay elapsed={elapsed} />}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="screenshot" className="max-w-full max-h-full rounded object-contain" />
        </div>
      )}
    </div>
  );
}

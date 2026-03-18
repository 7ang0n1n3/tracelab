"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.settings.get().then((s) => { setSettings(s); setLoading(false); });
  }, []);

  const set = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));
  const flag = (key: string) => settings[key] === "true";

  async function handleSave() {
    setSaving(true);
    await api.settings.update(settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="text-muted text-sm">Loading...</div>;

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Settings</h1>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          <Save size={13} />
          {saved ? "Saved!" : saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="bg-bg-surface border border-border rounded-lg divide-y divide-border">
        {/* Headless */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-200">Headless Mode</div>
            <div className="text-xs text-muted mt-0.5">Run tests without a visible browser window</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={flag("headless")}
              onChange={(e) => set("headless", String(e.target.checked))} />
            <div className="w-9 h-5 bg-bg-elevated peer-focus:outline-none rounded-full peer
              peer-checked:after:translate-x-full peer-checked:bg-accent
              after:content-[''] after:absolute after:top-0.5 after:left-[2px]
              after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
          </label>
        </div>

        {/* Slow Mo */}
        <div className="px-5 py-4">
          <div className="text-sm text-slate-200 mb-1">Slow Motion Delay (ms)</div>
          <div className="text-xs text-muted mb-2">Delay between each Playwright action</div>
          <input type="number" min="0" max="5000" step="50"
            value={settings.slowMo ?? "0"}
            onChange={(e) => set("slowMo", e.target.value)}
            className="w-32 bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-accent" />
        </div>

        {/* Timeout */}
        <div className="px-5 py-4">
          <div className="text-sm text-slate-200 mb-1">Default Timeout (ms)</div>
          <div className="text-xs text-muted mb-2">Max wait time for Playwright actions</div>
          <input type="number" min="1000" max="120000" step="1000"
            value={settings.timeout ?? "30000"}
            onChange={(e) => set("timeout", e.target.value)}
            className="w-32 bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-accent" />
        </div>

        {/* Screenshots */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-200">Capture Screenshots</div>
            <div className="text-xs text-muted mt-0.5">Auto-capture a screenshot at end of each run</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={flag("captureScreenshots")}
              onChange={(e) => set("captureScreenshots", String(e.target.checked))} />
            <div className="w-9 h-5 bg-bg-elevated peer-focus:outline-none rounded-full peer
              peer-checked:after:translate-x-full peer-checked:bg-accent
              after:content-[''] after:absolute after:top-0.5 after:left-[2px]
              after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
          </label>
        </div>

        {/* Video */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-200">Record Video</div>
            <div className="text-xs text-muted mt-0.5">Save a video recording of each run (increases artifact size)</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={flag("captureVideo")}
              onChange={(e) => set("captureVideo", String(e.target.checked))} />
            <div className="w-9 h-5 bg-bg-elevated peer-focus:outline-none rounded-full peer
              peer-checked:after:translate-x-full peer-checked:bg-accent
              after:content-[''] after:absolute after:top-0.5 after:left-[2px]
              after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
          </label>
        </div>

        {/* Trace */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-200">Capture Trace</div>
            <div className="text-xs text-muted mt-0.5">Save Playwright trace.zip for debugging failed runs</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={flag("captureTrace")}
              onChange={(e) => set("captureTrace", String(e.target.checked))} />
            <div className="w-9 h-5 bg-bg-elevated peer-focus:outline-none rounded-full peer
              peer-checked:after:translate-x-full peer-checked:bg-accent
              after:content-[''] after:absolute after:top-0.5 after:left-[2px]
              after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
          </label>
        </div>
      </div>
    </div>
  );
}

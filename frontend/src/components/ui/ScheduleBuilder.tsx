// /frontend/src/components/ui/ScheduleBuilder.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Freq,
  FREQ_OPTIONS,
  DAY_OPTIONS,
  DOM_OPTIONS,
  buildCron,
  needsTime,
} from "@/lib/schedule";

interface Props {
  onChange: (cron: string) => void;
}

const selectClass =
  "bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-accent";

export function ScheduleBuilder({ onChange }: Props) {
  const [freq, setFreq] = useState<Freq>("daily");
  const [time, setTime] = useState("09:00");
  const [weekday, setWeekday] = useState("1");
  const [dom, setDom] = useState("1");

  useEffect(() => {
    onChange(buildCron(freq, time, weekday, dom));
  }, [freq, time, weekday, dom]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Frequency */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted shrink-0">Run</span>
        <select value={freq} onChange={(e) => setFreq(e.target.value as Freq)} className={selectClass}>
          {FREQ_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Day picker — weekly only */}
      {freq === "weekly" && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted shrink-0">on</span>
          <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className={selectClass}>
            {DAY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Day-of-month picker — monthly only */}
      {freq === "monthly" && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted shrink-0">on day</span>
          <select value={dom} onChange={(e) => setDom(e.target.value)} className={selectClass}>
            {DOM_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Time picker */}
      {needsTime(freq) && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted shrink-0">at</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={`${selectClass} w-28`}
          />
        </div>
      )}
    </div>
  );
}

// /frontend/src/lib/schedule.ts
// Shared schedule utilities — cron builder, parser, human-readable display

export type Freq =
  | "every15min"
  | "every30min"
  | "hourly"
  | "every2h"
  | "every6h"
  | "every12h"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly";

export const FREQ_OPTIONS: { value: Freq; label: string }[] = [
  { value: "every15min", label: "Every 15 minutes" },
  { value: "every30min", label: "Every 30 minutes" },
  { value: "hourly",     label: "Every hour" },
  { value: "every2h",   label: "Every 2 hours" },
  { value: "every6h",   label: "Every 6 hours" },
  { value: "every12h",  label: "Every 12 hours" },
  { value: "daily",     label: "Every day" },
  { value: "weekdays",  label: "Every weekday (Mon–Fri)" },
  { value: "weekly",    label: "Every week on…" },
  { value: "monthly",   label: "Every month on day…" },
];

export const DAY_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

export const DOM_OPTIONS: { value: string; label: string }[] = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

/** Whether the frequency needs a time picker */
export function needsTime(freq: Freq): boolean {
  return ["daily", "weekdays", "weekly", "monthly"].includes(freq);
}

/** Build a cron expression from UI state */
export function buildCron(freq: Freq, time: string, weekday: string, dom: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr ?? "9", 10);
  const m = parseInt(mStr ?? "0", 10);
  switch (freq) {
    case "every15min": return "*/15 * * * *";
    case "every30min": return "*/30 * * * *";
    case "hourly":     return "0 * * * *";
    case "every2h":    return "0 */2 * * *";
    case "every6h":    return "0 */6 * * *";
    case "every12h":   return "0 */12 * * *";
    case "daily":      return `${m} ${h} * * *`;
    case "weekdays":   return `${m} ${h} * * 1-5`;
    case "weekly":     return `${m} ${h} * * ${weekday}`;
    case "monthly":    return `${m} ${h} ${dom} * *`;
  }
}

/** Convert a cron expression to a human-readable string */
export function cronToHuman(expr: string): string {
  const parsed = parseCron(expr);
  if (!parsed) return expr; // fall back to raw cron for unrecognized patterns
  const { freq, time, weekday, dom } = parsed;
  const timeStr = needsTime(freq) ? ` at ${time}` : "";
  const dayLabel = DAY_OPTIONS.find((d) => d.value === weekday)?.label ?? "Monday";
  switch (freq) {
    case "every15min": return "Every 15 minutes";
    case "every30min": return "Every 30 minutes";
    case "hourly":     return "Every hour";
    case "every2h":    return "Every 2 hours";
    case "every6h":    return "Every 6 hours";
    case "every12h":   return "Every 12 hours";
    case "daily":      return `Every day${timeStr}`;
    case "weekdays":   return `Every weekday (Mon–Fri)${timeStr}`;
    case "weekly":     return `Every ${dayLabel}${timeStr}`;
    case "monthly":    return `Monthly on day ${dom}${timeStr}`;
  }
}

export interface ParsedCron {
  freq: Freq;
  time: string;
  weekday: string;
  dom: string;
}

/** Parse a known cron expression back into UI state. Returns null for unrecognized patterns. */
export function parseCron(expr: string): ParsedCron | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, month, dow] = parts;
  if (month !== "*") return null;

  // Fixed-interval patterns
  if (min === "*/15" && hour === "*" && dom === "*" && dow === "*") return { freq: "every15min", time: "09:00", weekday: "1", dom: "1" };
  if (min === "*/30" && hour === "*" && dom === "*" && dow === "*") return { freq: "every30min", time: "09:00", weekday: "1", dom: "1" };
  if (min === "0"    && hour === "*" && dom === "*" && dow === "*") return { freq: "hourly",     time: "09:00", weekday: "1", dom: "1" };
  if (min === "0" && hour === "*/2"  && dom === "*" && dow === "*") return { freq: "every2h",   time: "09:00", weekday: "1", dom: "1" };
  if (min === "0" && hour === "*/6"  && dom === "*" && dow === "*") return { freq: "every6h",   time: "09:00", weekday: "1", dom: "1" };
  if (min === "0" && hour === "*/12" && dom === "*" && dow === "*") return { freq: "every12h",  time: "09:00", weekday: "1", dom: "1" };

  // Time-based patterns — parse hour and minute
  const h = parseInt(hour, 10);
  const m = parseInt(min, 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  if (dom === "*" && dow === "*")   return { freq: "daily",    time, weekday: "1", dom: "1" };
  if (dom === "*" && dow === "1-5") return { freq: "weekdays", time, weekday: "1", dom: "1" };
  if (dom === "*" && /^[0-6]$/.test(dow)) return { freq: "weekly",   time, weekday: dow, dom: "1" };
  if (dow === "*" && /^\d+$/.test(dom)) {
    const d = parseInt(dom, 10);
    if (d >= 1 && d <= 28) return { freq: "monthly", time, weekday: "1", dom };
  }

  return null;
}

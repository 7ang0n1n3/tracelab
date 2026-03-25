// /backend/src/scheduler/index.ts
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { Schedule, Test } from "../types";
import { dispatchRun } from "../runner/executor";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cronParser = require("cron-parser");

export function computeNextRun(cronExpr: string, from: Date = new Date()): Date | null {
  try {
    const interval = cronParser.parseExpression(cronExpr, { currentDate: from });
    return interval.next().toDate() as Date;
  } catch {
    return null;
  }
}

export function validateCron(cronExpr: string): boolean {
  try {
    cronParser.parseExpression(cronExpr);
    return true;
  } catch {
    return false;
  }
}

export async function checkSchedules(): Promise<void> {
  const now = Date.now();
  const due = db.prepare(`
    SELECT * FROM schedules
    WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?
  `).all(now) as unknown as Schedule[];

  for (const sched of due) {
    const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(sched.test_id) as Test | undefined;
    if (!test) {
      // Test was deleted but cascade didn't fire — disable schedule
      db.prepare("UPDATE schedules SET enabled = 0 WHERE id = ?").run(sched.id);
      continue;
    }

    const runId = uuidv4();
    db.prepare(
      "INSERT INTO runs (id, test_id, status, schedule_id, created_at) VALUES (?, ?, 'pending', ?, ?)"
    ).run(runId, test.id, sched.id, now);

    // Compute + store next occurrence before dispatch
    const nextDate = computeNextRun(sched.cron_expr);
    db.prepare(
      "UPDATE schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?"
    ).run(now, nextDate ? nextDate.getTime() : null, sched.id);

    dispatchRun(runId, test).catch((err) =>
      console.error(`[scheduler] dispatch error for schedule ${sched.id}:`, err)
    );
  }
}

export function initScheduler(): void {
  console.log("[TraceLab] Scheduler started — checking every 60s");
  // Delay first check by 5s to let DB fully initialize
  setTimeout(() => {
    checkSchedules().catch((err) => console.error("[scheduler] check error:", err));
  }, 5000);
  setInterval(() => {
    checkSchedules().catch((err) => console.error("[scheduler] check error:", err));
  }, 60_000);
}

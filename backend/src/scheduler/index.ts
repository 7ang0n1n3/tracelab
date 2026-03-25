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

// Minimum allowed schedule interval: 5 minutes (prevents scheduler abuse)
const MIN_INTERVAL_MS = 5 * 60 * 1000;
// Maximum cron expression length (prevents parser DoS via huge input)
const MAX_CRON_LENGTH = 100;

export function validateCron(cronExpr: string): boolean {
  if (!cronExpr || cronExpr.length > MAX_CRON_LENGTH) return false;
  try {
    const interval = cronParser.parseExpression(cronExpr);
    const first = interval.next().getTime();
    const second = interval.next().getTime();
    if (second - first < MIN_INTERVAL_MS) return false;
    return true;
  } catch {
    return false;
  }
}

function creatorHasWriteAccess(test: Test, creatorId: string, creatorRole: string): boolean {
  if (creatorRole === "admin") return true;
  if (test.user_id === creatorId) return true;
  if (!test.user_id) return false; // orphaned test — admin-only
  const share = db.prepare(`
    SELECT permission FROM test_shares
    WHERE test_id = ? AND (
      (grantee_type = 'user' AND grantee_id = ?) OR
      (grantee_type = 'role' AND grantee_id = ?)
    )
    ORDER BY CASE permission WHEN 'write' THEN 0 ELSE 1 END
    LIMIT 1
  `).get(test.id, creatorId, creatorRole) as { permission: string } | undefined;
  return share?.permission === "write";
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
      console.warn(`[scheduler] schedule ${sched.id} disabled — test ${sched.test_id} no longer exists`);
      continue;
    }

    // Re-validate that the schedule creator still has write access to the test.
    // Access may have been revoked since the schedule was created.
    if (sched.created_by) {
      const creator = db.prepare("SELECT id, role, disabled FROM users WHERE id = ?")
        .get(sched.created_by) as { id: string; role: string; disabled: number } | undefined;

      if (!creator || creator.disabled) {
        db.prepare("UPDATE schedules SET enabled = 0 WHERE id = ?").run(sched.id);
        console.warn(`[scheduler] schedule ${sched.id} disabled — creator ${sched.created_by} not found or is disabled`);
        continue;
      }

      if (!creatorHasWriteAccess(test, creator.id, creator.role)) {
        db.prepare("UPDATE schedules SET enabled = 0 WHERE id = ?").run(sched.id);
        console.warn(`[scheduler] schedule ${sched.id} disabled — creator ${sched.created_by} no longer has write access to test ${test.id}`);
        continue;
      }
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

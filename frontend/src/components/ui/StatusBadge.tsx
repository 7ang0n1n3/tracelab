import { clsx } from "clsx";

type Status = "pending" | "running" | "passed" | "failed" | "error";

const labels: Record<Status, string> = {
  pending: "Pending",
  running: "Running",
  passed: "Passed",
  failed: "Failed",
  error: "Error",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={clsx("text-xs px-2 py-0.5 rounded font-mono", `status-${status}`)}>
      {labels[status] ?? status}
    </span>
  );
}

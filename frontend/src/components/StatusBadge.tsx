import { Status } from "@/lib/api";

const STYLES: Record<Status, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  UNDER_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const DOT_STYLES: Record<Status, string> = {
  DRAFT: "bg-zinc-500",
  SUBMITTED: "bg-blue-500",
  UNDER_REVIEW: "bg-amber-500",
  APPROVED: "bg-green-500",
  REJECTED: "bg-red-500",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[status]}`} />
      {status.replace("_", " ")}
    </span>
  );
}

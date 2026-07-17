import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: number;
  accent?: "orange" | "amber" | "green" | "red" | "zinc";
  icon?: (props: { className?: string }) => ReactNode;
}

const ACCENT_BORDER: Record<NonNullable<StatCardProps["accent"]>, string> = {
  orange: "border-l-orange-500",
  amber: "border-l-amber-500",
  green: "border-l-green-500",
  red: "border-l-red-500",
  zinc: "border-l-zinc-400 dark:border-l-zinc-600",
};

const ACCENT_BADGE: Record<NonNullable<StatCardProps["accent"]>, string> = {
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  green: "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400",
  red: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400",
  zinc: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export function StatCard({ label, value, accent = "zinc", icon: Icon }: StatCardProps) {
  return (
    <div
      className={`animate-fade-in-up rounded-lg border border-zinc-200 border-l-4 bg-white px-4 py-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 ${ACCENT_BORDER[accent]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        {Icon && (
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ACCENT_BADGE[accent]}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}

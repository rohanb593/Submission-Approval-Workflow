interface StatCardProps {
  label: string;
  value: number;
  accent?: "indigo" | "amber" | "green" | "red" | "zinc";
}

const ACCENT_BORDER: Record<NonNullable<StatCardProps["accent"]>, string> = {
  indigo: "border-l-indigo-500",
  amber: "border-l-amber-500",
  green: "border-l-green-500",
  red: "border-l-red-500",
  zinc: "border-l-zinc-400 dark:border-l-zinc-600",
};

export function StatCard({ label, value, accent = "zinc" }: StatCardProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 border-l-4 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 ${ACCENT_BORDER[accent]}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}

import { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

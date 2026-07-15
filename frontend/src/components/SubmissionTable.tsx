import Link from "next/link";
import { Application } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

function formatUpdated(iso: string) {
  return new Date(iso).toLocaleString();
}

export function SubmissionTable({ applications }: { applications: Application[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <th className="px-4 py-3">Submission</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {applications.map((app) => (
            <tr key={app.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <td className="px-4 py-3">
                <Link href={`/applications/${app.id}`} className="block">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{app.title}</span>
                  {app.amount != null && (
                    <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                      ${app.amount.toFixed(2)}
                    </span>
                  )}
                </Link>
              </td>
              <td className="px-4 py-3 capitalize text-zinc-600 dark:text-zinc-400">
                {app.category}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={app.status} />
              </td>
              <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                {formatUpdated(app.updated_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

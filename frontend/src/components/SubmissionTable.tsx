import Link from "next/link";
import { Application } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

function formatUpdated(iso: string) {
  return new Date(iso).toLocaleString();
}

interface SubmissionTableProps {
  applications: Application[];
  // True only when every row is guaranteed to belong to the signed-in user
  // (the requester's own "My Submissions" list) - the reviewer/admin view
  // mixes owners and only has owner_id (a UUID), which isn't worth showing.
  showOwner?: boolean;
}

export function SubmissionTable({ applications, showOwner = false }: SubmissionTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm dark:border-zinc-800">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-4 py-3.5">Submission</th>
              <th className="px-4 py-3.5">Category</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {applications.map((app, i) => (
              <tr
                key={app.id}
                style={{ animationDelay: `${Math.min(i * 25, 250)}ms` }}
                className="animate-fade-in-up bg-white transition-colors duration-150 hover:bg-orange-50/60 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-3.5">
                  <Link href={`/applications/${app.id}`} className="block">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{app.title}</span>
                    {app.amount != null && (
                      <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                        ${app.amount.toFixed(2)}
                      </span>
                    )}
                    {app.description && (
                      <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-zinc-500 dark:text-zinc-400">
                        {app.description}
                      </p>
                    )}
                    {showOwner && (
                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">Owner: You</p>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3.5 capitalize text-zinc-600 dark:text-zinc-400">
                  {app.category}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={app.status} />
                </td>
                <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400">
                  {formatUpdated(app.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

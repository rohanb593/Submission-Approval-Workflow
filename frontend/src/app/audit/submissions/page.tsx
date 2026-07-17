"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRequireRole } from "@/lib/use-require-role";
import { listSubmissionAudit, SubmissionAuditEntry, ApiError, Status } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: SubmissionAuditEntry[]; total: number };

const PAGE_SIZE = 20;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function SubmissionAuditPage() {
  const user = useRequireRole("admin");
  const { token } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  function handleSearchChange(next: string) {
    setState({ status: "loading" });
    setSearch(next);
    setPage(1);
  }

  function handlePageChange(next: number) {
    setState({ status: "loading" });
    setPage(next);
  }

  useEffect(() => {
    if (!user || !token) return;
    let cancelled = false;

    listSubmissionAudit(token, { search, page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setState({ status: "ready", entries: result.entries, total: result.total });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "Failed to load submission audit log.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [user, token, search, page]);

  if (!user) return null;

  const total = state.status === "ready" ? state.total : undefined;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-7xl px-8 py-10">
        <PageHeader
          eyebrow="Governance"
          title="Submission Audit"
          subtitle="Submission creation, edit, and workflow transition events."
          action={
            total !== undefined ? (
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
                {total} record{total === 1 ? "" : "s"}
              </span>
            ) : undefined
          }
        />

        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search audit events, actors, submissions..."
        />

        {state.status === "loading" && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading submission audit log...</p>
        )}

        {state.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        )}

        {state.status === "ready" && state.entries.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {state.total === 0 && !search ? "No submission activity recorded yet." : "No events match this search."}
          </p>
        )}

        {state.status === "ready" && state.entries.length > 0 && (
          <>
            <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm dark:border-zinc-800">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                      <th className="px-4 py-3.5">Time</th>
                      <th className="px-4 py-3.5">Submission</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Actor</th>
                      <th className="px-4 py-3.5">Comment</th>
                      <th className="px-4 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {state.entries.map((entry, i) => (
                      <tr
                        key={entry.id}
                        style={{ animationDelay: `${Math.min(i * 25, 250)}ms` }}
                        className="animate-fade-in-up bg-white transition-colors duration-150 hover:bg-orange-50/60 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                          {formatDate(entry.created_at)}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-zinc-50">
                          {entry.application_title}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={entry.to_status as Status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">{entry.actor_email}</p>
                          <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">{entry.actor_role}</p>
                        </td>
                        <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">
                          {entry.comment || "No comment"}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            href={`/applications/${entry.application_id}`}
                            className="inline-block rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-orange-800 dark:hover:bg-orange-950/40 dark:hover:text-orange-300"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={state.total} onPageChange={handlePageChange} />
          </>
        )}
      </main>
    </AppShell>
  );
}

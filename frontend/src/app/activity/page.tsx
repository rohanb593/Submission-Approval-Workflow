"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRequireRole } from "@/lib/use-require-role";
import { listActivity, ActivityEntry, ApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { SearchInput } from "@/components/SearchInput";
import { Pagination } from "@/components/Pagination";
import { ActivityDetailModal } from "@/components/ActivityDetailModal";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: ActivityEntry[] };

const PAGE_SIZE = 20;

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  POST: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function methodBadgeStyle(method: string) {
  return METHOD_STYLES[method] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function ActivityAuditPage() {
  const user = useRequireRole("admin");
  const { token } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ActivityEntry | null>(null);

  useEffect(() => {
    if (!user || !token) return;
    let cancelled = false;

    listActivity(token)
      .then((entries) => {
        if (!cancelled) setState({ status: "ready", entries });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "Failed to load activity log.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [user, token]);

  const all = useMemo(() => (state.status === "ready" ? state.entries : []), [state]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (e) =>
        e.actor_email.toLowerCase().includes(term) ||
        e.ip_address.toLowerCase().includes(term) ||
        e.path.toLowerCase().includes(term),
    );
  }, [all, search]);

  const stats = useMemo(() => {
    const errors = all.filter((e) => e.status_code >= 400).length;
    const uniqueActors = new Set(all.map((e) => e.actor_email)).size;
    const avgDuration = all.length
      ? Math.round(all.reduce((sum, e) => sum + e.duration_ms, 0) / all.length)
      : 0;
    return { total: all.length, errors, uniqueActors, avgDuration };
  }, [all]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSearchChange(next: string) {
    setSearch(next);
    setPage(1);
  }

  if (!user) return null;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-7xl px-8 py-10">
        <div className="mb-1 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-600" />
          </span>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Live audit trail</span>
        </div>

        <PageHeader
          eyebrow="Governance"
          title="Activity Audit"
          subtitle="Authenticated user movements across workflow endpoints."
        />

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Events" value={stats.total} accent="zinc" />
          <StatCard label="Errors" value={stats.errors} accent="red" />
          <StatCard label="Unique Actors" value={stats.uniqueActors} accent="orange" />
          <StatCard label="Avg Duration" value={stats.avgDuration} accent="amber" />
        </div>

        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search audit events, actors, IPs..."
        />

        {state.status === "loading" && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading activity log...</p>
        )}

        {state.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        )}

        {state.status === "ready" && filtered.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {all.length === 0 ? "No activity recorded yet." : "No events match this search."}
          </p>
        )}

        {state.status === "ready" && filtered.length > 0 && (
          <>
            <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm dark:border-zinc-800">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                      <th className="px-4 py-3.5">Time</th>
                      <th className="px-4 py-3.5">User</th>
                      <th className="px-4 py-3.5">Action</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Browser</th>
                      <th className="px-4 py-3.5">Duration</th>
                      <th className="px-4 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {paginated.map((entry, i) => (
                      <tr
                        key={entry.id}
                        style={{ animationDelay: `${Math.min(i * 25, 250)}ms` }}
                        className="animate-fade-in-up cursor-pointer bg-white transition-colors duration-150 hover:bg-orange-50/60 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                        onClick={() => setSelected(entry)}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                          {formatDate(entry.created_at)}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">
                            {entry.actor_email}
                          </p>
                          <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                            {entry.actor_role}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${methodBadgeStyle(entry.method)}`}
                          >
                            {entry.method}
                          </span>{" "}
                          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                            {entry.path}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              entry.status_code < 400
                                ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            }`}
                          >
                            {entry.status_code}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">
                          {entry.browser}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">
                          {entry.duration_ms}ms
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(entry);
                            }}
                            className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-orange-800 dark:hover:bg-orange-950/40 dark:hover:text-orange-300"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </>
        )}
      </main>

      {selected && <ActivityDetailModal entry={selected} onClose={() => setSelected(null)} />}
    </AppShell>
  );
}

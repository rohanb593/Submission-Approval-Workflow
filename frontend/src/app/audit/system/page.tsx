"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRequireRole } from "@/lib/use-require-role";
import { listSystemAudit, SystemAuditEntry, ApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Pagination } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { AuditRecordModal } from "@/components/AuditRecordModal";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: SystemAuditEntry[]; total: number };

const PAGE_SIZE = 20;

const EVENT_OPTIONS = [
  { label: "All event types", value: "" },
  { label: "User created", value: "user.created" },
  { label: "Role changed", value: "user.role_changed" },
  { label: "User deleted", value: "user.deleted" },
];

const EVENT_STYLES: Record<string, string> = {
  "user.created": "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  "user.role_changed": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "user.deleted": "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function eventBadgeStyle(event: string) {
  return EVENT_STYLES[event] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function SystemAuditPage() {
  const user = useRequireRole("admin");
  const { token } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [event, setEvent] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SystemAuditEntry | null>(null);

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

    listSystemAudit(token, { search, event, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!cancelled) setState({ status: "ready", entries: res.entries, total: res.total });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "Failed to load system audit log.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [user, token, search, event, page]);

  if (!user) return null;

  const total = state.status === "ready" ? state.total : undefined;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-7xl px-8 py-10">
        <PageHeader
          eyebrow="Governance"
          title="System Audit"
          subtitle="User, role, and permission administration events."
          action={
            total !== undefined ? (
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
                {total} record{total === 1 ? "" : "s"}
              </span>
            ) : undefined
          }
        />

        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Search audit events, actors, resources..."
            />
          </div>
          <Select
            value={event}
            onChange={(e) => {
              setState({ status: "loading" });
              setEvent(e.target.value);
              setPage(1);
            }}
            wrapperClassName="mb-6 w-48"
          >
            {EVENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {state.status === "loading" && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading system audit log...</p>
        )}

        {state.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        )}

        {state.status === "ready" && state.entries.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {state.total === 0 && !search && !event
              ? "No administrative activity recorded yet."
              : "No events match this search."}
          </p>
        )}

        {state.status === "ready" && state.entries.length > 0 && (
          <>
            <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm dark:border-zinc-800">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                      <th className="px-4 py-3.5">Time</th>
                      <th className="px-4 py-3.5">Event</th>
                      <th className="px-4 py-3.5">Resource</th>
                      <th className="px-4 py-3.5">Actor</th>
                      <th className="px-4 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {state.entries.map((entry, i) => (
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
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${eventBadgeStyle(entry.event)}`}
                          >
                            {entry.event}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">{entry.resource_label}</p>
                          <p className="text-xs uppercase text-zinc-400 dark:text-zinc-500">
                            {entry.resource_type}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">{entry.actor_email}</p>
                          <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">{entry.actor_role}</p>
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
            <Pagination page={page} pageSize={PAGE_SIZE} total={state.total} onPageChange={handlePageChange} />
          </>
        )}
      </main>

      {selected && (
        <AuditRecordModal
          eyebrow="System Audit"
          title={selected.event}
          timestamp={formatDate(selected.created_at)}
          onClose={() => setSelected(null)}
          fields={[
            { label: "Resource Type", value: selected.resource_type },
            { label: "Resource", value: selected.resource_label },
            { label: "Actor", value: selected.actor_email },
            { label: "Actor Role", value: selected.actor_role },
          ]}
        />
      )}
    </AppShell>
  );
}

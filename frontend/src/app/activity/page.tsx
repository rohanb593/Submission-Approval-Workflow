"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRequireRole } from "@/lib/use-require-role";
import { listActivity, ActivityEntry, ApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ActivityDetailModal } from "@/components/ActivityDetailModal";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: ActivityEntry[] };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function ActivityAuditPage() {
  const user = useRequireRole("admin");
  const { token } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");
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

  if (!user) return null;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl px-8 py-10">
        <PageHeader
          eyebrow="Governance"
          title="Activity Audit"
          subtitle="Authenticated user movements across workflow endpoints."
        />

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search audit events, actors, IPs..."
          className="mb-6 w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Browser</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filtered.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {entry.actor_email}
                      </p>
                      <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                        {entry.actor_role}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {entry.method}
                      </span>{" "}
                      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {entry.path}
                      </span>
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {entry.browser}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {entry.duration_ms}ms
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(entry)}
                        className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selected && <ActivityDetailModal entry={selected} onClose={() => setSelected(null)} />}
    </AppShell>
  );
}

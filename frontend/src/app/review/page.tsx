"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRequireRole } from "@/lib/use-require-role";
import { listApplications, Application, ApiError, Status } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; applications: Application[] };

const FILTERS: { label: string; value: Status | "" }[] = [
  { label: "All", value: "" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Under Review", value: "UNDER_REVIEW" },
  { label: "Draft", value: "DRAFT" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

export default function ReviewDashboard() {
  const user = useRequireRole(["reviewer", "admin"]);
  const { token } = useAuth();
  const [filter, setFilter] = useState<Status | "">("");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!user || !token) return;
    let cancelled = false;

    listApplications(token, filter || undefined)
      .then((applications) => {
        if (!cancelled) setState({ status: "ready", applications });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "Failed to load applications.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [user, token, filter]);

  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title={user.role === "admin" ? "All Applications" : "Applications to Review"} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {state.status === "loading" && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading applications...</p>
        )}

        {state.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        )}

        {state.status === "ready" && state.applications.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No applications match this filter.
          </p>
        )}

        {state.status === "ready" && state.applications.length > 0 && (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {state.applications.map((app) => (
              <li key={app.id}>
                <Link
                  href={`/applications/${app.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {app.title}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {app.category}
                      {app.amount != null ? ` · $${app.amount.toFixed(2)}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={app.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

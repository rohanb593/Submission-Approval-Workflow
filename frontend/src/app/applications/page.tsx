"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRequireRole } from "@/lib/use-require-role";
import { listApplications, Application, ApiError } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; applications: Application[] };

export default function ApplicantDashboard() {
  const user = useRequireRole("applicant");
  const { token } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!user || !token) return;
    let cancelled = false;

    listApplications(token)
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
  }, [user, token]);

  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="My Applications" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-6 flex justify-end">
          <Link
            href="/applications/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            New Application
          </Link>
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
            You haven&apos;t created any applications yet.
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

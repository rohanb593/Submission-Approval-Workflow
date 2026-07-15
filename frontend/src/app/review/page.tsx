"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRequireRole } from "@/lib/use-require-role";
import { listApplications, Application, ApiError, Status } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { FilterChips } from "@/components/FilterChips";
import { SubmissionTable } from "@/components/SubmissionTable";

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
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [filter, setFilter] = useState<Status | "">("");

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

  const all = useMemo(
    () => (state.status === "ready" ? state.applications : []),
    [state],
  );
  const stats = useMemo(
    () => ({
      total: all.length,
      needsReview: all.filter((a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW")
        .length,
      approved: all.filter((a) => a.status === "APPROVED").length,
      rejected: all.filter((a) => a.status === "REJECTED").length,
    }),
    [all],
  );
  const filtered = filter ? all.filter((a) => a.status === filter) : all;

  if (!user) return null;

  const isAdmin = user.role === "admin";

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-4xl px-8 py-10">
        <PageHeader
          eyebrow={isAdmin ? "Admin Dashboard" : "Reviewer Dashboard"}
          title={isAdmin ? "All Submissions" : "Review Queue"}
          subtitle={
            isAdmin
              ? "Every submission in the system. You can act on any status."
              : "Submissions awaiting your decision."
          }
        />

        {state.status === "ready" && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total" value={stats.total} accent="zinc" />
            <StatCard label="Needs Review" value={stats.needsReview} accent="amber" />
            <StatCard label="Approved" value={stats.approved} accent="green" />
            <StatCard label="Rejected" value={stats.rejected} accent="red" />
          </div>
        )}

        {state.status === "ready" && (
          <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        )}

        {state.status === "loading" && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading applications...</p>
        )}

        {state.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        )}

        {state.status === "ready" && filtered.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No applications match this filter.
          </p>
        )}

        {state.status === "ready" && filtered.length > 0 && (
          <SubmissionTable applications={filtered} />
        )}
      </main>
    </AppShell>
  );
}

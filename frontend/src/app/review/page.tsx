"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRequireRole } from "@/lib/use-require-role";
import { listApplications, Application, ApiError, Status } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { FilterChips } from "@/components/FilterChips";
import { SearchInput } from "@/components/SearchInput";
import { Pagination } from "@/components/Pagination";
import { SubmissionTable } from "@/components/SubmissionTable";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      applications: Application[];
      total: number;
      counts: Partial<Record<Status, number>>;
    };

const FILTERS: { label: string; value: Status | "" }[] = [
  { label: "All", value: "" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Under Review", value: "UNDER_REVIEW" },
  { label: "Draft", value: "DRAFT" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

const PAGE_SIZE = 20;

export default function ReviewDashboard() {
  const user = useRequireRole(["reviewer", "admin"]);
  const { token } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [filter, setFilter] = useState<Status | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  function handleFilterChange(next: Status | "") {
    setState({ status: "loading" });
    setFilter(next);
    setPage(1);
  }

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

    listApplications(token, { status: filter, search, page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) {
          setState({
            status: "ready",
            applications: result.applications,
            total: result.total,
            counts: result.counts,
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "Failed to load applications.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [user, token, filter, search, page]);

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const counts = state.status === "ready" ? state.counts : {};
  const stats = {
    total: Object.values(counts).reduce((sum: number, n) => sum + (n ?? 0), 0),
    needsReview: (counts.SUBMITTED ?? 0) + (counts.UNDER_REVIEW ?? 0),
    approved: counts.APPROVED ?? 0,
    rejected: counts.REJECTED ?? 0,
  };

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

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total" value={stats.total} accent="zinc" />
          <StatCard label="Needs Review" value={stats.needsReview} accent="amber" />
          <StatCard label="Approved" value={stats.approved} accent="green" />
          <StatCard label="Rejected" value={stats.rejected} accent="red" />
        </div>

        <SearchInput value={search} onChange={handleSearchChange} placeholder="Search by title or description..." />

        <FilterChips options={FILTERS} value={filter} onChange={handleFilterChange} />

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
          <>
            <SubmissionTable applications={state.applications} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={state.total} onPageChange={handlePageChange} />
          </>
        )}
      </main>
    </AppShell>
  );
}

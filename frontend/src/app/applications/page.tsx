"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  { label: "Draft", value: "DRAFT" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Under Review", value: "UNDER_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

const PAGE_SIZE = 20;

export default function ApplicantDashboard() {
  const user = useRequireRole("requester");
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

  const counts = state.status === "ready" ? state.counts : {};
  const stats = {
    total: Object.values(counts).reduce((sum: number, n) => sum + (n ?? 0), 0),
    draft: counts.DRAFT ?? 0,
    inReview: (counts.SUBMITTED ?? 0) + (counts.UNDER_REVIEW ?? 0),
    approved: counts.APPROVED ?? 0,
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-7xl px-8 py-10">
        <PageHeader
          eyebrow="Requester Dashboard"
          title="My Submissions"
          subtitle="Track the status of applications you've created."
          action={
            <Link
              href="/applications/new"
              className="inline-block rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-orange-500 active:scale-[0.97]"
            >
              New Application
            </Link>
          }
        />

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total" value={stats.total} accent="zinc" />
          <StatCard label="Draft" value={stats.draft} accent="amber" />
          <StatCard label="In Review" value={stats.inReview} accent="orange" />
          <StatCard label="Approved" value={stats.approved} accent="green" />
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
            {state.total === 0 && !filter && !search
              ? "You haven't created any applications yet."
              : "No applications match this filter."}
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

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useRequireRole } from "@/lib/use-require-role";
import { dashboardPathFor } from "@/lib/roles";
import {
  getApplication,
  updateApplication,
  ApiError,
  ApplicationDetail,
  ApplicationInput,
  AuditEntry,
  Status,
} from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { ApplicationForm } from "@/components/ApplicationForm";
import { WorkflowActionPanel } from "@/components/WorkflowActionPanel";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; application: ApplicationDetail };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

interface Revision {
  number: number;
  entries: AuditEntry[];
}

// groupIntoRevisions splits a flat audit trail into per-revision groups. A
// new revision starts at every DRAFT -> SUBMITTED entry (a first submission
// or a resubmission after being returned for changes) - there's no separate
// revision counter in the backend, so this reconstructs it purely from the
// from/to status pairs already on each entry.
function groupIntoRevisions(auditLog: AuditEntry[]): Revision[] {
  const revisions: Revision[] = [];
  for (const entry of auditLog) {
    const startsNewRevision = entry.from_status === "DRAFT" && entry.to_status === "SUBMITTED";
    if (startsNewRevision || revisions.length === 0) {
      revisions.push({ number: revisions.length + 1, entries: [entry] });
    } else {
      revisions[revisions.length - 1].entries.push(entry);
    }
  }
  return revisions;
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useRequireRole(["requester", "reviewer", "admin"]);
  const { token } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    getApplication(token, id)
      .then((application) => setState({ status: "ready", application }))
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Failed to load application.";
        setState({ status: "error", message });
      });
  }, [token, id]);

  useEffect(() => {
    if (!user || !token) return;
    load();
  }, [user, token, load]);

  if (!user) return null;

  async function handleSaveDraft(input: ApplicationInput) {
    await updateApplication(token!, id, input);
    setEditing(false);
    load();
  }

  const isOwner = state.status === "ready" && state.application.owner_id === user.id;
  const isDraft = state.status === "ready" && state.application.status === "DRAFT";
  const canEdit = user.role === "requester" && isOwner && isDraft;

  const revisions = state.status === "ready" ? groupIntoRevisions(state.application.audit_log) : [];
  const lastEntry = state.status === "ready" ? state.application.audit_log.at(-1) : undefined;
  const returnedForChanges =
    isDraft && lastEntry?.from_status === "UNDER_REVIEW" && lastEntry?.to_status === "DRAFT"
      ? lastEntry
      : undefined;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl px-8 py-10">
        <Link
          href={dashboardPathFor(user.role)}
          className="mb-6 inline-block text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          &larr; Back
        </Link>

        {state.status === "loading" && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading application...</p>
        )}

        {state.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        )}

        {state.status === "ready" && returnedForChanges && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Returned for changes by {returnedForChanges.actor_email}
            </p>
            {returnedForChanges.comment && (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                {returnedForChanges.comment}
              </p>
            )}
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
              {formatDate(returnedForChanges.created_at)} &mdash; edit and resubmit when ready.
            </p>
          </div>
        )}

        {state.status === "ready" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {state.application.title}
                  </h1>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {state.application.description || "No description provided."}
                  </p>
                </div>
                <StatusBadge status={state.application.status} />
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Owner
                  </p>
                  <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                    {isOwner ? "You" : state.application.owner_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Created
                  </p>
                  <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                    {formatDate(state.application.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Updated
                  </p>
                  <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                    {formatDate(state.application.updated_at)}
                  </p>
                </div>
              </div>

              {editing ? (
                <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                  <ApplicationForm
                    submitLabel="Save Changes"
                    initialValues={{
                      title: state.application.title,
                      category: state.application.category,
                      description: state.application.description,
                      amount:
                        state.application.amount != null ? String(state.application.amount) : "",
                    }}
                    onSubmit={handleSaveDraft}
                  />
                  <button
                    onClick={() => setEditing(false)}
                    className="mt-3 text-sm text-zinc-500 hover:underline dark:text-zinc-400"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-md border border-orange-100 bg-orange-50/60 p-4 dark:border-orange-900 dark:bg-orange-950/30">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Application Details
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Structured information submitted for this request.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-4 border-t border-orange-100 pt-3 dark:border-orange-900">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Category
                      </p>
                      <p className="mt-1 text-sm capitalize text-zinc-900 dark:text-zinc-50">
                        {state.application.category}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Amount
                      </p>
                      <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                        {state.application.amount != null
                          ? `$${state.application.amount.toFixed(2)}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {canEdit && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="mt-4 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Edit Submission
                </button>
              )}
            </div>

            <div className="flex flex-col gap-6">
              <WorkflowActionPanel
                applicationId={id}
                status={state.application.status}
                role={user.role}
                isOwner={isOwner}
                token={token!}
                onActionComplete={load}
              />

              <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Revision History
                  </h3>
                  {revisions.length > 0 && (
                    <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                      Revision {revisions.length}
                    </span>
                  )}
                </div>
                {revisions.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No status changes yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-6">
                    {revisions.map((revision) => (
                      <div key={revision.number}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                          Revision {revision.number}
                        </p>
                        <ul className="flex flex-col gap-4">
                          {revision.entries.map((entry) => {
                            const wasReturned =
                              entry.from_status === "UNDER_REVIEW" && entry.to_status === "DRAFT";
                            return (
                              <li
                                key={entry.id}
                                className={`border-l-2 pl-3 ${
                                  wasReturned ? "border-amber-500" : "border-orange-500"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={entry.to_status as Status} />
                                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {formatDate(entry.created_at)}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                                  {entry.actor_email}
                                </p>
                                {entry.comment && (
                                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                                    {entry.comment}
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
                  {state.application.audit_log.length} record
                  {state.application.audit_log.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}

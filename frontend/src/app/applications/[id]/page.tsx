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
  transitionApplication,
  ApiError,
  ApplicationDetail,
  ApplicationInput,
} from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ApplicationForm } from "@/components/ApplicationForm";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; application: ApplicationDetail };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useRequireRole(["requester", "reviewer", "admin"]);
  const { token } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

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
    load();
  }

  async function handleSubmitForReview() {
    setActionError(null);
    setSubmittingAction(true);
    try {
      await transitionApplication(token!, id, "submit");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to submit application.");
    } finally {
      setSubmittingAction(false);
    }
  }

  const isOwnerDraftEditable =
    state.status === "ready" &&
    user.role === "requester" &&
    state.application.owner_id === user.id &&
    state.application.status === "DRAFT";

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Application" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
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

        {state.status === "ready" && (
          <div className="flex flex-col gap-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {state.application.title}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {state.application.category}
                  {state.application.amount != null
                    ? ` · $${state.application.amount.toFixed(2)}`
                    : ""}
                </p>
              </div>
              <StatusBadge status={state.application.status} />
            </div>

            {isOwnerDraftEditable ? (
              <div>
                <ApplicationForm
                  submitLabel="Save Changes"
                  initialValues={{
                    title: state.application.title,
                    category: state.application.category,
                    description: state.application.description,
                    amount: state.application.amount != null ? String(state.application.amount) : "",
                  }}
                  onSubmit={handleSaveDraft}
                />

                <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                  {actionError && (
                    <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
                      {actionError}
                    </p>
                  )}
                  <button
                    onClick={handleSubmitForReview}
                    disabled={submittingAction}
                    className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    {submittingAction ? "Submitting..." : "Submit for Review"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                {state.application.description || "No description provided."}
              </p>
            )}

            <div>
              <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Audit Trail
              </h3>
              {state.application.audit_log.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No status changes yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {state.application.audit_log.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                    >
                      <p className="text-zinc-900 dark:text-zinc-50">
                        <span className="font-medium">{entry.actor_email}</span>{" "}
                        moved this from <span className="font-medium">{entry.from_status}</span>{" "}
                        to <span className="font-medium">{entry.to_status}</span>
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDate(entry.created_at)}
                      </p>
                      {entry.comment && (
                        <p className="mt-2 text-zinc-700 dark:text-zinc-300">{entry.comment}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

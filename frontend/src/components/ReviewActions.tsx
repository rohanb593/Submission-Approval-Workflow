"use client";

import { useState } from "react";
import { ApiError, Status, TransitionAction, transitionApplication } from "@/lib/api";

interface ActionSpec {
  action: TransitionAction;
  label: string;
  requiresComment: boolean;
}

// Reviewers only get the action(s) that are legal from the application's
// current status, mirroring the backend state machine exactly.
const REVIEWER_ACTIONS_BY_STATUS: Partial<Record<Status, ActionSpec[]>> = {
  SUBMITTED: [{ action: "start-review", label: "Start Review", requiresComment: false }],
  UNDER_REVIEW: [
    { action: "approve", label: "Approve", requiresComment: false },
    { action: "reject", label: "Reject", requiresComment: true },
    { action: "return", label: "Return for Changes", requiresComment: true },
  ],
};

// Admins can perform any of these regardless of the application's current
// status — the backend bypasses the from-status rules for the admin role.
const ADMIN_ACTIONS: ActionSpec[] = [
  { action: "start-review", label: "Start Review", requiresComment: false },
  { action: "approve", label: "Approve", requiresComment: false },
  { action: "reject", label: "Reject", requiresComment: true },
  { action: "return", label: "Return for Changes", requiresComment: true },
];

interface ReviewActionsProps {
  applicationId: string;
  status: Status;
  role: "reviewer" | "admin";
  token: string;
  onActionComplete: () => void;
}

export function ReviewActions({
  applicationId,
  status,
  role,
  token,
  onActionComplete,
}: ReviewActionsProps) {
  const [activeAction, setActiveAction] = useState<ActionSpec | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions = role === "admin" ? ADMIN_ACTIONS : REVIEWER_ACTIONS_BY_STATUS[status] ?? [];

  if (actions.length === 0) {
    return null;
  }

  async function runAction(spec: ActionSpec, commentValue: string) {
    setError(null);
    setSubmitting(true);
    try {
      await transitionApplication(token, applicationId, spec.action, commentValue);
      setActiveAction(null);
      setComment("");
      onActionComplete();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That action failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClick(spec: ActionSpec) {
    if (spec.requiresComment) {
      setActiveAction(spec);
      setError(null);
      return;
    }
    runAction(spec, "");
  }

  return (
    <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {role === "admin" ? "Admin Override" : "Review Actions"}
      </h3>

      <div className="flex flex-wrap gap-2">
        {actions.map((spec) => (
          <button
            key={spec.action}
            onClick={() => handleClick(spec)}
            disabled={submitting}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {spec.label}
          </button>
        ))}
      </div>

      {activeAction && (
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Comment (required for {activeAction.label})
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => runAction(activeAction, comment)}
              disabled={submitting || comment.trim() === ""}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {submitting ? "Submitting..." : `Confirm ${activeAction.label}`}
            </button>
            <button
              onClick={() => {
                setActiveAction(null);
                setComment("");
                setError(null);
              }}
              disabled={submitting}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

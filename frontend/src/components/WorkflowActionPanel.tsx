"use client";

import { useState } from "react";
import { ApiError, Role, Status, TransitionAction, transitionApplication } from "@/lib/api";

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

function actionsFor(role: Role, isOwner: boolean, status: Status): ActionSpec[] {
  if (role === "admin") return ADMIN_ACTIONS;
  if (role === "reviewer") return REVIEWER_ACTIONS_BY_STATUS[status] ?? [];
  if (role === "requester" && isOwner && status === "DRAFT") {
    return [{ action: "submit", label: "Submit for Review", requiresComment: false }];
  }
  return [];
}

interface WorkflowActionPanelProps {
  applicationId: string;
  status: Status;
  role: Role;
  isOwner: boolean;
  token: string;
  onActionComplete: () => void;
}

export function WorkflowActionPanel({
  applicationId,
  status,
  role,
  isOwner,
  token,
  onActionComplete,
}: WorkflowActionPanelProps) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<TransitionAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = actionsFor(role, isOwner, status);
  if (actions.length === 0) {
    return null;
  }

  async function handleClick(spec: ActionSpec) {
    setError(null);
    if (spec.requiresComment && comment.trim() === "") {
      setError(`A decision note is required to ${spec.label.toLowerCase()}.`);
      return;
    }
    setSubmitting(spec.action);
    try {
      await transitionApplication(token, applicationId, spec.action, comment);
      setComment("");
      onActionComplete();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That action failed. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Workflow Action
      </h3>

      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Decision note
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Required for Reject / Return for Changes"
        className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
      />

      <div className="flex flex-col gap-2">
        {actions.map((spec) => (
          <button
            key={spec.action}
            onClick={() => handleClick(spec)}
            disabled={submitting !== null}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            {submitting === spec.action ? "Submitting..." : spec.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

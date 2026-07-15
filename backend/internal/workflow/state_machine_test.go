package workflow

import (
	"errors"
	"testing"
)

func TestTransition(t *testing.T) {
	tests := []struct {
		name    string
		from    Status
		action  Action
		role    Role
		isOwner bool
		comment string
		wantTo  Status
		wantErr error // nil means the transition should succeed
	}{
		// Legal transitions.
		{
			name:    "owner submits a draft",
			from:    StatusDraft,
			action:  ActionSubmit,
			role:    RoleRequester,
			isOwner: true,
			wantTo:  StatusSubmitted,
		},
		{
			name:   "reviewer starts review",
			from:   StatusSubmitted,
			action: ActionStartReview,
			role:   RoleReviewer,
			wantTo: StatusUnderReview,
		},
		{
			name:   "reviewer approves",
			from:   StatusUnderReview,
			action: ActionApprove,
			role:   RoleReviewer,
			wantTo: StatusApproved,
		},
		{
			name:    "reviewer rejects with comment",
			from:    StatusUnderReview,
			action:  ActionReject,
			role:    RoleReviewer,
			comment: "budget exceeds policy limit",
			wantTo:  StatusRejected,
		},
		{
			name:    "reviewer returns for changes with comment",
			from:    StatusUnderReview,
			action:  ActionReturnForChanges,
			role:    RoleReviewer,
			comment: "please attach a receipt",
			wantTo:  StatusDraft,
		},

		// Illegal transitions: no rule exists for this (status, action) pair.
		{
			name:    "cannot approve a draft",
			from:    StatusDraft,
			action:  ActionApprove,
			role:    RoleReviewer,
			wantErr: ErrIllegalTransition,
		},
		{
			name:    "cannot submit an already-submitted application",
			from:    StatusSubmitted,
			action:  ActionSubmit,
			role:    RoleRequester,
			isOwner: true,
			wantErr: ErrIllegalTransition,
		},
		{
			name:    "cannot skip straight from submitted to approved",
			from:    StatusSubmitted,
			action:  ActionApprove,
			role:    RoleReviewer,
			wantErr: ErrIllegalTransition,
		},
		{
			name:    "approved is terminal",
			from:    StatusApproved,
			action:  ActionSubmit,
			role:    RoleRequester,
			isOwner: true,
			wantErr: ErrIllegalTransition,
		},
		{
			name:    "rejected is terminal",
			from:    StatusRejected,
			action:  ActionStartReview,
			role:    RoleReviewer,
			wantErr: ErrIllegalTransition,
		},

		// Forbidden: the transition exists, but this actor can't do it.
		{
			name:    "non-owner requester cannot submit",
			from:    StatusDraft,
			action:  ActionSubmit,
			role:    RoleRequester,
			isOwner: false,
			wantErr: ErrForbidden,
		},
		{
			name:    "requester cannot start review",
			from:    StatusSubmitted,
			action:  ActionStartReview,
			role:    RoleRequester,
			wantErr: ErrForbidden,
		},
		{
			name:    "requester cannot approve their own application",
			from:    StatusUnderReview,
			action:  ActionApprove,
			role:    RoleRequester,
			isOwner: true,
			wantErr: ErrForbidden,
		},
		{
			name:    "requester cannot reject",
			from:    StatusUnderReview,
			action:  ActionReject,
			role:    RoleRequester,
			comment: "trying to reject my own submission",
			wantErr: ErrForbidden,
		},

		// Admin overrides: any action is legal from any status, bypassing the
		// from-status rules above entirely.
		{
			name:   "admin approves directly from draft",
			from:   StatusDraft,
			action: ActionApprove,
			role:   RoleAdmin,
			wantTo: StatusApproved,
		},
		{
			name:    "admin rejects a submitted application without review",
			from:    StatusSubmitted,
			action:  ActionReject,
			role:    RoleAdmin,
			comment: "policy violation",
			wantTo:  StatusRejected,
		},
		{
			name:    "admin can reopen a terminal (approved) application",
			from:    StatusApproved,
			action:  ActionReturnForChanges,
			role:    RoleAdmin,
			comment: "reopening for correction",
			wantTo:  StatusDraft,
		},
		{
			name:    "admin reject still requires a comment",
			from:    StatusUnderReview,
			action:  ActionReject,
			role:    RoleAdmin,
			comment: "",
			wantErr: ErrCommentRequired,
		},

		// Comment required: transition exists, actor is allowed, comment missing.
		{
			name:    "reject without a comment is rejected",
			from:    StatusUnderReview,
			action:  ActionReject,
			role:    RoleReviewer,
			comment: "",
			wantErr: ErrCommentRequired,
		},
		{
			name:    "reject with whitespace-only comment is rejected",
			from:    StatusUnderReview,
			action:  ActionReject,
			role:    RoleReviewer,
			comment: "   ",
			wantErr: ErrCommentRequired,
		},
		{
			name:    "return for changes without a comment is rejected",
			from:    StatusUnderReview,
			action:  ActionReturnForChanges,
			role:    RoleReviewer,
			comment: "",
			wantErr: ErrCommentRequired,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Transition(tt.from, tt.action, tt.role, tt.isOwner, tt.comment)

			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("Transition() error = %v, want error wrapping %v", err, tt.wantErr)
				}
				return
			}

			if err != nil {
				t.Fatalf("Transition() unexpected error: %v", err)
			}
			if got != tt.wantTo {
				t.Errorf("Transition() = %v, want %v", got, tt.wantTo)
			}
		})
	}
}

func TestIsTerminal(t *testing.T) {
	terminal := []Status{StatusApproved, StatusRejected}
	for _, s := range terminal {
		if !IsTerminal(s) {
			t.Errorf("IsTerminal(%v) = false, want true", s)
		}
	}

	nonTerminal := []Status{StatusDraft, StatusSubmitted, StatusUnderReview}
	for _, s := range nonTerminal {
		if IsTerminal(s) {
			t.Errorf("IsTerminal(%v) = true, want false", s)
		}
	}
}

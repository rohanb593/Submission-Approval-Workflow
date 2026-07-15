// Package workflow implements the application status state machine: the
// single source of truth for which status transitions are legal, who is
// allowed to perform them, and what they require.
package workflow

import (
	"errors"
	"fmt"
	"strings"
)

type Status string

const (
	StatusDraft       Status = "DRAFT"
	StatusSubmitted   Status = "SUBMITTED"
	StatusUnderReview Status = "UNDER_REVIEW"
	StatusApproved    Status = "APPROVED"
	StatusRejected    Status = "REJECTED"
)

type Role string

const (
	RoleRequester Role = "requester"
	RoleReviewer  Role = "reviewer"
	// RoleAdmin can perform any reviewer action from any status — see
	// adminOverrides below — bypassing the normal from-status rules.
	RoleAdmin Role = "admin"
)

type Action string

const (
	ActionSubmit           Action = "submit"
	ActionStartReview      Action = "start_review"
	ActionApprove          Action = "approve"
	ActionReject           Action = "reject"
	ActionReturnForChanges Action = "return_for_changes"
)

var (
	// ErrIllegalTransition means there's no rule for this (status, action)
	// pair at all — e.g. approving a DRAFT application.
	ErrIllegalTransition = errors.New("illegal transition")
	// ErrForbidden means the transition exists but this actor isn't allowed
	// to perform it — wrong role, or not the application's owner.
	ErrForbidden = errors.New("actor not permitted to perform this transition")
	// ErrCommentRequired means the transition exists and the actor is
	// allowed to perform it, but it requires a non-empty comment.
	ErrCommentRequired = errors.New("comment is required for this transition")
)

type transitionRule struct {
	To              Status
	AllowedRole     Role
	RequireOwner    bool
	RequiresComment bool
}

type transitionKey struct {
	From   Status
	Action Action
}

var transitions = map[transitionKey]transitionRule{
	{StatusDraft, ActionSubmit}: {
		To:           StatusSubmitted,
		AllowedRole:  RoleRequester,
		RequireOwner: true,
	},
	{StatusSubmitted, ActionStartReview}: {
		To:          StatusUnderReview,
		AllowedRole: RoleReviewer,
	},
	{StatusUnderReview, ActionApprove}: {
		To:          StatusApproved,
		AllowedRole: RoleReviewer,
	},
	{StatusUnderReview, ActionReject}: {
		To:              StatusRejected,
		AllowedRole:     RoleReviewer,
		RequiresComment: true,
	},
	{StatusUnderReview, ActionReturnForChanges}: {
		To:              StatusDraft,
		AllowedRole:     RoleReviewer,
		RequiresComment: true,
	},
}

// adminOverrides defines, for each action, the resulting status and comment
// requirement admins get regardless of the application's current status.
// Everyone else must go through the from-status rules in transitions above.
var adminOverrides = map[Action]transitionRule{
	ActionSubmit:           {To: StatusSubmitted},
	ActionStartReview:      {To: StatusUnderReview},
	ActionApprove:          {To: StatusApproved},
	ActionReject:           {To: StatusRejected, RequiresComment: true},
	ActionReturnForChanges: {To: StatusDraft, RequiresComment: true},
}

// Transition attempts to move an application from its current status via
// action, performed by an actor with actorRole. isOwner is only consulted
// for owner-restricted transitions (currently just submit). It returns the
// resulting status, or an error identifying exactly why the transition was
// rejected: illegal (no such rule), forbidden (wrong role/not owner), or a
// missing required comment.
//
// Admins bypass the from-status check entirely: any action is legal from
// any current status, though reject/return still require a comment.
func Transition(current Status, action Action, actorRole Role, isOwner bool, comment string) (Status, error) {
	if actorRole == RoleAdmin {
		rule, ok := adminOverrides[action]
		if !ok {
			return "", fmt.Errorf("%w: unknown action %s", ErrIllegalTransition, action)
		}
		if rule.RequiresComment && strings.TrimSpace(comment) == "" {
			return "", fmt.Errorf("%w: %q requires a comment", ErrCommentRequired, action)
		}
		return rule.To, nil
	}

	rule, ok := transitions[transitionKey{From: current, Action: action}]
	if !ok {
		return "", fmt.Errorf("%w: cannot %s from status %s", ErrIllegalTransition, action, current)
	}

	if rule.AllowedRole != actorRole {
		return "", fmt.Errorf("%w: role %q cannot perform %q", ErrForbidden, actorRole, action)
	}

	if rule.RequireOwner && !isOwner {
		return "", fmt.Errorf("%w: only the owner can perform %q", ErrForbidden, action)
	}

	if rule.RequiresComment && strings.TrimSpace(comment) == "" {
		return "", fmt.Errorf("%w: %q requires a comment", ErrCommentRequired, action)
	}

	return rule.To, nil
}

// IsTerminal reports whether status has no outgoing transitions.
func IsTerminal(status Status) bool {
	return status == StatusApproved || status == StatusRejected
}

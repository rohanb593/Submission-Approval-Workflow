"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { dashboardPathFor } from "@/lib/roles";

function BrandMark({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-sm font-black text-blue-950">
        A
      </span>
      <span
        className={`text-lg font-bold tracking-tight ${
          dark ? "text-zinc-900 dark:text-zinc-50" : "text-white"
        }`}
      >
        Approvals
      </span>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden w-full max-w-md flex-col justify-between overflow-hidden bg-blue-950 p-10 text-white lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-orange-600 opacity-30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-orange-500 opacity-20 blur-3xl"
      />

      <BrandMark className="relative" />

      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">
          Submission &amp; Approval Workflow
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">
          Submit, review, and approve &mdash; all in one place.
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-blue-200">
          Sign in to track your submissions, clear your review queue, or manage the workflow
          across your organization.
        </p>
      </div>

      <p className="relative text-xs text-blue-300">
        Secure sign-in for requesters, reviewers, and admins.
      </p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, login, verifyCode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(dashboardPathFor(user.role));
    }
  }, [isLoading, user, router]);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.user) {
        router.replace(dashboardPathFor(result.user.role));
      } else {
        setChallengeId(result.challengeId);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to log in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    setError(null);
    setSubmitting(true);
    try {
      const loggedInUser = await verifyCode(challengeId, code);
      router.replace(dashboardPathFor(loggedInUser.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to verify code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function backToPasswordStep() {
    setChallengeId(null);
    setCode("");
    setError(null);
  }

  if (isLoading || user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-1 bg-white dark:bg-blue-950">
      <BrandPanel />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <BrandMark className="mb-10 lg:hidden" dark />

        {challengeId ? (
          <form onSubmit={handleCodeSubmit} className="w-full max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400">
              Verification
            </p>
            <h2 className="mb-2 mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Enter verification code
            </h2>
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              We emailed a 6-digit code to <span className="font-medium text-zinc-700 dark:text-zinc-300">{email}</span>. It expires in 10 minutes.
            </p>

            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Verification code
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-center text-lg tracking-[0.5em] text-zinc-900 transition-colors focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />

            {error && (
              <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="mb-3 w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
            >
              {submitting ? "Verifying..." : "Verify"}
            </button>

            <button
              type="button"
              onClick={backToPasswordStep}
              className="w-full text-center text-sm text-zinc-500 hover:text-orange-600 hover:underline dark:text-zinc-400 dark:hover:text-orange-400"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="w-full max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400">
              Welcome back
            </p>
            <h2 className="mb-6 mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Sign in
            </h2>

            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 transition-colors focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />

            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Password
            </label>
            <div className="relative mb-4">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 pr-16 text-sm text-zinc-900 transition-colors focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-3.5 text-xs font-medium text-zinc-500 hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

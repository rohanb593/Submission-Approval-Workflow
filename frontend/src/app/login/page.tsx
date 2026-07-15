"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { dashboardPathFor } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, login, verifyCode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const id = await login(email, password);
      setChallengeId(id);
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
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      {challengeId ? (
        <form
          onSubmit={handleCodeSubmit}
          className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Enter verification code
          </h1>
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            We emailed a 6-digit code to {email}. It expires in 10 minutes.
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
            className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-center text-lg tracking-[0.5em] text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />

          {error && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="mb-3 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {submitting ? "Verifying..." : "Verify"}
          </button>

          <button
            type="button"
            onClick={backToPasswordStep}
            className="w-full text-center text-sm text-zinc-600 hover:underline dark:text-zinc-400"
          >
            Back to sign in
          </button>
        </form>
      ) : (
        <form
          onSubmit={handlePasswordSubmit}
          className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Sign in
          </h1>

          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />

          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Password
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />

          {error && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}

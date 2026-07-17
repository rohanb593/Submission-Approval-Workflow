"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRequireRole } from "@/lib/use-require-role";
import {
  AdminUser,
  ApiError,
  Role,
  listUsers,
  createUser,
  updateUserRole,
  deleteUser,
} from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CreateUserModal } from "@/components/CreateUserModal";
import { Select } from "@/components/Select";

const ROLES: Role[] = ["requester", "reviewer", "admin"];

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; users: AdminUser[] };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export default function UserManagementPage() {
  const currentUser = useRequireRole("admin");
  const { token } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [isCreating, setIsCreating] = useState(false);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function load() {
    if (!token) return;
    listUsers(token)
      .then((users) => setState({ status: "ready", users }))
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Failed to load users.";
        setState({ status: "error", message });
      });
  }

  useEffect(() => {
    if (!currentUser || !token) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, token]);

  if (!currentUser) return null;

  async function handleCreate(input: { email: string; password: string; role: Role }) {
    if (!token) return;
    const user = await createUser(token, input);
    setState((prev) => (prev.status === "ready" ? { status: "ready", users: [...prev.users, user] } : prev));
    setIsCreating(false);
  }

  async function handleRoleChange(id: string, role: Role) {
    if (!token) return;
    setRowError(null);
    setPendingId(id);
    try {
      const updated = await updateUserRole(token, id, role);
      setState((prev) =>
        prev.status === "ready"
          ? { status: "ready", users: prev.users.map((u) => (u.id === id ? updated : u)) }
          : prev,
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update role.";
      setRowError({ id, message });
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setRowError(null);
    setPendingId(id);
    try {
      await deleteUser(token, id);
      setState((prev) =>
        prev.status === "ready"
          ? { status: "ready", users: prev.users.filter((u) => u.id !== id) }
          : prev,
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete user.";
      setRowError({ id, message });
    } finally {
      setPendingId(null);
    }
  }

  const users = state.status === "ready" ? state.users : [];

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-7xl px-8 py-10">
        <PageHeader
          eyebrow="Governance"
          title="User Management"
          subtitle="Provision accounts and manage roles across the workflow."
          action={
            <button
              onClick={() => setIsCreating(true)}
              className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white transition-all duration-150 hover:bg-orange-500 active:scale-[0.97]"
            >
              New User
            </button>
          }
        />

        {state.status === "loading" && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading users...</p>
        )}

        {state.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        )}

        {state.status === "ready" && users.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No users yet.</p>
        )}

        {state.status === "ready" && users.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm dark:border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    <th className="px-4 py-3.5">Email</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5">Created</th>
                    <th className="px-4 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {users.map((u, i) => {
                    const isSelf = u.id === currentUser.id;
                    const isPending = pendingId === u.id;
                    return (
                      <tr
                        key={u.id}
                        style={{ animationDelay: `${Math.min(i * 25, 250)}ms` }}
                        className="animate-fade-in-up bg-white transition-colors duration-150 hover:bg-orange-50/60 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">{u.email}</p>
                          {isSelf && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">You</p>
                          )}
                          {rowError?.id === u.id && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                              {rowError.message}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <Select
                            value={u.role}
                            disabled={isSelf || isPending}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                            wrapperClassName="w-36"
                            className="py-1.5 capitalize"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400">
                          {formatDate(u.created_at)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => handleDelete(u.id)}
                            disabled={isSelf || isPending}
                            className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 transition-all duration-150 hover:bg-red-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {isCreating && (
        <CreateUserModal onClose={() => setIsCreating(false)} onCreate={handleCreate} />
      )}
    </AppShell>
  );
}

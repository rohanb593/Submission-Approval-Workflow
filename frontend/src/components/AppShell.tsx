"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Role } from "@/lib/api";
import { NotificationsBell } from "@/components/NotificationsBell";

interface NavItem {
  label: string;
  href: string;
}

function navItemsFor(role: Role): NavItem[] {
  if (role === "requester") {
    return [{ label: "My Submissions", href: "/applications" }];
  }
  if (role === "admin") {
    return [
      { label: "All Submissions", href: "/review" },
      { label: "Activity Audit", href: "/activity" },
      { label: "User Management", href: "/admin/users" },
    ];
  }
  return [{ label: "Review Queue", href: "/review" }];
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const navItems = user ? navItemsFor(user.role) : [];

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-60 shrink-0 flex-col bg-slate-950 text-slate-100">
        <div className="px-5 py-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
            Submission Workflow
          </p>
          <p className="mt-1 text-lg font-bold text-white">Approvals</p>
        </div>

        <nav className="flex-1 px-3">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-1 block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="border-t border-slate-800 px-4 py-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                {initials(user.email)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{user.email}</p>
                <p className="text-xs capitalize text-slate-400">{user.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        )}
      </aside>

      <div className="flex-1 bg-white dark:bg-zinc-950">
        <div className="flex justify-end border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <NotificationsBell />
        </div>
        {children}
      </div>
    </div>
  );
}

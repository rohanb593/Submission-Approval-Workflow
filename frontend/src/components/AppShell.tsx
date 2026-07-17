"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Role } from "@/lib/api";
import { NotificationsBell } from "@/components/NotificationsBell";

interface NavItem {
  label: string;
  href: string;
  icon: (props: { className?: string }) => React.ReactElement;
}

function DocumentsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75h6m-6 3.75h4.5M12.75 3.75H6.75A2.25 2.25 0 004.5 6v12a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0019.5 18V10.5L12.75 3.75z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.75V9a1.5 1.5 0 001.5 1.5h5.25" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx={12} cy={12} r={8.25} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 2.25" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.5v-1.125a3.375 3.375 0 00-3.375-3.375h-3.75A3.375 3.375 0 004.5 18.375V19.5m15 0v-1.125a3 3 0 00-2.25-2.906M15 9.75a3 3 0 10-3-3m6.75 5.25a3 3 0 10-3-3M11.25 9.75a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function navItemsFor(role: Role): NavItem[] {
  if (role === "requester") {
    return [{ label: "My Submissions", href: "/applications", icon: DocumentsIcon }];
  }
  if (role === "admin") {
    return [
      { label: "All Submissions", href: "/review", icon: DocumentsIcon },
      { label: "Activity Audit", href: "/activity", icon: ClockIcon },
      { label: "User Management", href: "/admin/users", icon: UsersIcon },
    ];
  }
  return [{ label: "Review Queue", href: "/review", icon: DocumentsIcon }];
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

const COLLAPSE_STORAGE_KEY = "sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // One-time read of a browser-only API after mount: a lazy useState initializer
  // would run during SSR too and always see no localStorage, then read the real
  // value on the client's first render, causing a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true");
    setHydrated(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      return next;
    });
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const navItems = user ? navItemsFor(user.role) : [];

  return (
    <div className="flex min-h-screen flex-1">
      <aside
        className={`relative flex shrink-0 flex-col bg-blue-950 text-zinc-100 transition-[width] duration-300 ease-in-out ${
          collapsed ? "w-[76px]" : "w-64"
        } ${hydrated ? "" : "duration-0"}`}
      >
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-8 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-blue-800 bg-white text-blue-950 shadow-md transition-transform hover:scale-110 dark:bg-zinc-100"
        >
          <ChevronIcon className={`h-3.5 w-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>

        <div className={`flex items-center gap-3 px-5 py-6 ${collapsed ? "justify-center px-0" : ""}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-sm font-black text-blue-950">
            A
          </span>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden whitespace-nowrap">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400">
                Submission Workflow
              </p>
              <p className="text-base font-bold text-white">Approvals</p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`group mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  collapsed ? "justify-center px-0" : ""
                } ${
                  active
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-blue-200 hover:translate-x-0.5 hover:bg-blue-900 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="animate-fade-in truncate whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className={`border-t border-blue-900 px-4 py-4 ${collapsed ? "px-2" : ""}`}>
            <div className={`mb-3 flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
              <span
                title={collapsed ? user.email : undefined}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-semibold text-white"
              >
                {initials(user.email)}
              </span>
              {!collapsed && (
                <div className="min-w-0 animate-fade-in overflow-hidden whitespace-nowrap">
                  <p className="truncate text-sm font-medium text-white">{user.email}</p>
                  <p className="text-xs capitalize text-blue-300">{user.role}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              title={collapsed ? "Log out" : undefined}
              className="w-full rounded-md border border-blue-800 px-3 py-1.5 text-sm font-medium text-blue-100 transition-colors hover:bg-blue-900"
            >
              {collapsed ? "⏻" : "Log out"}
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

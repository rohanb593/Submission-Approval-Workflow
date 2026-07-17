"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Role } from "@/lib/api";
import { NotificationsBell } from "@/components/NotificationsBell";

type Icon = (props: { className?: string }) => React.ReactElement;

interface NavLink {
  type: "link";
  label: string;
  href: string;
  icon: Icon;
}

interface NavGroup {
  type: "group";
  label: string;
  icon: Icon;
  items: { label: string; href: string; icon: Icon }[];
}

type NavEntry = NavLink | NavGroup;

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

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5h9M9 9h9M9 13.5h9M9 18h9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l.75.75L6.75 3.75M4.5 9l.75.75L6.75 8.25M4.5 13.5l.75.75L6.75 12.75" />
    </svg>
  );
}

function SessionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15M12 12h8.25m0 0l-3-3m3 3l-3 3M3 12h3"
      />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75l2.25 2.25 4.5-4.5m4.5-3.09V6.75a2.25 2.25 0 00-1.883-2.22 47.68 47.68 0 00-8.234 0A2.25 2.25 0 003.75 6.75v.66a51.16 51.16 0 00-.66 8.14 12.02 12.02 0 007.44 8.13 12.02 12.02 0 007.44-8.13c.44-2.64.66-5.36.66-8.14z"
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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 12H8.25m9.75 0l-3-3m3 3l-3 3"
      />
    </svg>
  );
}

function navItemsFor(role: Role): NavEntry[] {
  if (role === "requester") {
    return [{ type: "link", label: "My Submissions", href: "/applications", icon: DocumentsIcon }];
  }
  if (role === "admin") {
    return [
      { type: "link", label: "All Submissions", href: "/review", icon: DocumentsIcon },
      {
        type: "group",
        label: "Audit Trail",
        icon: ClockIcon,
        items: [
          { label: "Submission Audit", href: "/audit/submissions", icon: ChecklistIcon },
          { label: "Activity Audit", href: "/activity", icon: ClockIcon },
          { label: "Session Audit", href: "/audit/sessions", icon: SessionIcon },
          { label: "System Audit", href: "/audit/system", icon: ShieldIcon },
        ],
      },
      { type: "link", label: "User Management", href: "/admin/users", icon: UsersIcon },
    ];
  }
  return [{ type: "link", label: "Review Queue", href: "/review", icon: DocumentsIcon }];
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

const COLLAPSE_STORAGE_KEY = "sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [auditTrailOpen, setAuditTrailOpen] = useState(true);

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
        className={`relative flex shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 ${
          collapsed ? "w-[76px]" : "w-64"
        } ${hydrated ? "" : "duration-0"}`}
      >
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-8 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-500 shadow-md transition-transform hover:scale-110 hover:text-orange-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
        >
          <ChevronIcon className={`h-3.5 w-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>

        <div className={`flex items-center gap-3 border-b border-zinc-200 px-5 py-6 dark:border-zinc-800 ${collapsed ? "justify-center px-0" : ""}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-sm font-black text-white">
            A
          </span>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden whitespace-nowrap">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400">
                Submission Workflow
              </p>
              <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">Approvals</p>
            </div>
          )}
        </div>

        <div className="flex-1 px-3 py-4">
          {!collapsed && (
            <p className="animate-fade-in mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Workflow modules
            </p>
          )}
          <nav>
            {navItems.map((entry) => {
              if (entry.type === "link") {
                const active = isActivePath(pathname, entry.href);
                const Icon = entry.icon;
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    title={collapsed ? entry.label : undefined}
                    className={`group mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                      collapsed ? "justify-center px-0" : ""
                    } ${
                      active
                        ? "bg-orange-600 text-white shadow-sm"
                        : "text-zinc-600 hover:translate-x-0.5 hover:bg-orange-50 hover:text-orange-700 dark:text-zinc-400 dark:hover:bg-orange-950/30 dark:hover:text-orange-300"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span className="animate-fade-in truncate whitespace-nowrap">{entry.label}</span>}
                  </Link>
                );
              }

              // Group entry (e.g. "Audit Trail"): a set of sub-pages, collapsible
              // independently of the whole-sidebar collapse.
              const GroupIcon = entry.icon;
              const groupActive = entry.items.some((i) => isActivePath(pathname, i.href));

              if (collapsed) {
                // No room for an indented sub-list when the sidebar itself is
                // collapsed - link straight to the group's first page instead.
                return (
                  <Link
                    key={entry.label}
                    href={entry.items[0].href}
                    title={entry.label}
                    className={`group mb-1 flex items-center justify-center rounded-lg px-0 py-2.5 text-sm font-medium transition-all duration-150 ${
                      groupActive
                        ? "bg-orange-600 text-white shadow-sm"
                        : "text-zinc-600 hover:bg-orange-50 hover:text-orange-700 dark:text-zinc-400 dark:hover:bg-orange-950/30 dark:hover:text-orange-300"
                    }`}
                  >
                    <GroupIcon className="h-5 w-5 shrink-0" />
                  </Link>
                );
              }

              return (
                <div key={entry.label} className="mb-1">
                  <button
                    onClick={() => setAuditTrailOpen((v) => !v)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                      groupActive
                        ? "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                        : "text-zinc-600 hover:bg-orange-50 hover:text-orange-700 dark:text-zinc-400 dark:hover:bg-orange-950/30 dark:hover:text-orange-300"
                    }`}
                  >
                    <GroupIcon className="h-5 w-5 shrink-0" />
                    <span className="flex-1 truncate text-left">{entry.label}</span>
                    <ChevronDownIcon
                      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${auditTrailOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {auditTrailOpen && (
                    <div className="animate-fade-in-up mt-1 flex flex-col gap-1 border-l border-zinc-200 pl-4 dark:border-zinc-800">
                      {entry.items.map((item) => {
                        const active = isActivePath(pathname, item.href);
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                              active
                                ? "bg-orange-600 text-white shadow-sm"
                                : "text-zinc-600 hover:translate-x-0.5 hover:bg-orange-50 hover:text-orange-700 dark:text-zinc-400 dark:hover:bg-orange-950/30 dark:hover:text-orange-300"
                            }`}
                          >
                            <ItemIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="flex-1 bg-white dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
            Workflow
          </span>

          <div className="flex items-center gap-4">
            <NotificationsBell />
            {user && (
              <>
                <span className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-semibold text-white">
                    {initials(user.email)}
                  </span>
                  <div className="hidden min-w-0 sm:block">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{user.email}</p>
                    <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">{user.role}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  aria-label="Log out"
                  title="Log out"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                >
                  <LogoutIcon className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Role } from "@/lib/api";
import { dashboardPathFor } from "@/lib/roles";

// useRequireRole redirects to /login if nobody is signed in, or to the
// caller's own dashboard if they're signed in with a role that isn't in
// allowedRoles. Pages should treat a null return as "still deciding" and
// render nothing.
export function useRequireRole(allowedRoles: Role | Role[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isAllowed = !!user && roles.includes(user.role);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!roles.includes(user.role)) {
      router.replace(dashboardPathFor(user.role));
    }
    // roles is derived fresh from allowedRoles every render; comparing by
    // value (via join) avoids re-running this effect on every render when
    // callers pass an inline array literal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, roles.join(","), router]);

  if (isLoading || !isAllowed) {
    return null;
  }
  return user;
}

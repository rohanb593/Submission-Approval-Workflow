"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Role } from "@/lib/api";

function dashboardPathFor(role: Role) {
  return role === "reviewer" ? "/review" : "/applications";
}

// useRequireRole redirects to /login if nobody is signed in, or to the
// caller's own dashboard if they're signed in with the wrong role. Pages
// should treat a null return as "still deciding" and render nothing.
export function useRequireRole(role: Role) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== role) {
      router.replace(dashboardPathFor(user.role));
    }
  }, [isLoading, user, role, router]);

  if (isLoading || !user || user.role !== role) {
    return null;
  }
  return user;
}

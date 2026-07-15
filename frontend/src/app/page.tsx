"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { dashboardPathFor } from "@/lib/roles";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? dashboardPathFor(user.role) : "/login");
  }, [isLoading, user, router]);

  return null;
}

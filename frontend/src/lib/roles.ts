import { Role } from "@/lib/api";

// Requesters manage their own applications; reviewers and admins share the
// review dashboard (admins can additionally act on any status once there).
export function dashboardPathFor(role: Role): string {
  return role === "requester" ? "/applications" : "/review";
}

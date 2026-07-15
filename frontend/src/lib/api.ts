// Thin client for the Go backend. Every page/component should call through
// here rather than using fetch directly, so token attachment, base URL, and
// error shaping stay in one place.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type Role = "requester" | "reviewer" | "admin";

export interface User {
  id: string;
  email: string;
  role: Role;
}

export type Status = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

export interface Application {
  id: string;
  owner_id: string;
  title: string;
  category: string;
  description: string;
  amount: number | null;
  status: Status;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: string;
  actor_id: string;
  actor_email: string;
  from_status: string;
  to_status: string;
  comment: string | null;
  created_at: string;
}

export interface ApplicationDetail extends Application {
  audit_log: AuditEntry[];
}

export interface ApplicationInput {
  title: string;
  category: string;
  description: string;
  amount: number | null;
}

export type TransitionAction = "submit" | "start-review" | "approve" | "reject" | "return";

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface ActivityEntry {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_role: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  browser: string;
  ip_address: string;
  user_agent: string;
  referer: string;
  content_length: number;
  created_at: string;
}

// ApiError carries the HTTP status and, for 400s from the backend's
// validation errors, a field -> message map the UI can attach to inputs.
export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

interface RequestOptions {
  method?: string;
  token?: string | null;
  body?: unknown;
}

// REQUEST_TIMEOUT_MS bounds every call: fetch() has no default timeout, so a
// backend that hangs (e.g. an outbound SMTP call with no deadline of its
// own) would otherwise leave the UI stuck indefinitely with no error.
const REQUEST_TIMEOUT_MS = 20_000;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError(0, "The request timed out. Please try again.");
    }
    throw new ApiError(0, "Could not reach the server. Please try again.");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error?.message ?? `Request failed with status ${res.status}`;
    const fields = data?.error?.fields;
    throw new ApiError(res.status, message, fields);
  }

  return data as T;
}

// LoginResult is a union: with 2FA enabled the backend returns only
// challenge_id (proceed to verifyLoginCode); with 2FA disabled it returns
// token + user directly, same shape as verifyLoginCode's response.
export interface LoginResult {
  challenge_id?: string;
  token?: string;
  user?: User;
}

export function login(email: string, password: string) {
  return request<LoginResult>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function verifyLoginCode(challengeId: string, code: string) {
  return request<{ token: string; user: User }>("/auth/login/verify", {
    method: "POST",
    body: { challenge_id: challengeId, code },
  });
}

export function listApplications(token: string, status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<Application[]>(`/applications${qs}`, { token });
}

export function getApplication(token: string, id: string) {
  return request<ApplicationDetail>(`/applications/${id}`, { token });
}

export function createApplication(token: string, input: ApplicationInput) {
  return request<Application>("/applications", { method: "POST", token, body: input });
}

export function updateApplication(token: string, id: string, input: ApplicationInput) {
  return request<Application>(`/applications/${id}`, { method: "PUT", token, body: input });
}

export function transitionApplication(
  token: string,
  id: string,
  action: TransitionAction,
  comment?: string,
) {
  return request<Application>(`/applications/${id}/${action}`, {
    method: "POST",
    token,
    body: { comment: comment ?? "" },
  });
}

export function listActivity(token: string) {
  return request<ActivityEntry[]>("/activity", { token });
}

export function listUsers(token: string) {
  return request<AdminUser[]>("/admin/users", { token });
}

export function createUser(token: string, input: { email: string; password: string; role: Role }) {
  return request<AdminUser>("/admin/users", { method: "POST", token, body: input });
}

export function updateUserRole(token: string, id: string, role: Role) {
  return request<AdminUser>(`/admin/users/${id}/role`, { method: "PUT", token, body: { role } });
}

export function deleteUser(token: string, id: string) {
  return request<void>(`/admin/users/${id}`, { method: "DELETE", token });
}

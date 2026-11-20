const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, details: unknown) {
    super(describeDetails(details) || `API request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/** A readable message from a DRF error body ({detail}, field errors, or text). */
function describeDetails(details: unknown): string {
  if (typeof details === "string") return details.length < 300 ? details : "";
  if (!details || typeof details !== "object") return "";
  const detail = (details as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  return Object.entries(details as Record<string, unknown>)
    .map(([field, value]) => {
      const text = (Array.isArray(value) ? value : [value]).map(String).join(" ");
      return field === "non_field_errors" ? text : `${field}: ${text}`;
    })
    .join(" ");
}

function getCookie(name: string): string | null {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split("=")[1]) : null;
}

async function ensureCsrfToken() {
  if (getCookie("csrftoken")) return;

  await fetch(`${API_BASE_URL}/admin/login/`, {
    credentials: "include",
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method?.toUpperCase() || "GET";
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD") {
    await ensureCsrfToken();
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("json") ? await response.json() : await response.text();
  if (!response.ok) throw new ApiError(response.status, body);
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
};

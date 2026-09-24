import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { LoginCredentials, User, UserRole } from "../types/domain";

export type LoginResult = { ok: true } | { ok: false; error: string };

interface MeResponse {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role_name: UserRole;
  is_superuser: boolean;
}

function toUser(data: MeResponse): User {
  return {
    id: String(data.id),
    name: `${data.first_name} ${data.last_name}`.trim(),
    email: data.email,
    role: data.role_name,
    isSuperuser: data.is_superuser,
  };
}

/**
 * Owns login/logout and session restore. Authentication and the login
 * lockout are both enforced server-side (Django session + apps.accounts) —
 * this hook only reflects what the server decided, it never makes the
 * decision itself.
 */
export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [lockedUntilByUsername, setLockedUntilByUsername] = useState<Record<string, number>>({});

  useEffect(() => {
    api
      .get<MeResponse>("/api/v1/accounts/me/")
      .then((data) => setCurrentUser(toUser(data)))
      .catch(() => setCurrentUser(null))
      .finally(() => setIsRestoring(false));
  }, []);

  const getLockedUntil = (username: string): number | null => {
    return lockedUntilByUsername[username.trim().toLowerCase()] ?? null;
  };

  const login = async ({ username, password }: LoginCredentials): Promise<LoginResult> => {
    const key = username.trim().toLowerCase();
    try {
      const data = await api.post<MeResponse>("/api/v1/accounts/login/", { username, password });
      setLockedUntilByUsername((prev) => {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      });
      setCurrentUser(toUser(data));
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const lockedUntil = (err.details as { locked_until?: number })?.locked_until;
        if (lockedUntil) setLockedUntilByUsername((prev) => ({ ...prev, [key]: lockedUntil }));
        return { ok: false, error: "Too many failed attempts. Please wait for the lockout to expire." };
      }
      const detail = err instanceof ApiError ? (err.details as { detail?: string })?.detail : null;
      return { ok: false, error: detail || "Invalid username or password." };
    }
  };

  const logout = async () => {
    try {
      await api.post("/api/v1/accounts/logout/", {});
    } finally {
      setCurrentUser(null);
    }
  };

  return { currentUser, isRestoring, login, logout, getLockedUntil };
}

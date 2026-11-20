import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { BACKEND_ROLE_BY_UI, toUiRole } from "../api/roles";
import { recordAuditEvent } from "../utils/auditLog";
import { canAssignRole, canManageRoles, roleLabel } from "../utils/permissions";
import type { LoginCredentials, User, UserId, UserRole } from "../types/domain";

export type LoginResult = { ok: true } | { ok: false; error: string };
export type RoleChangeResult = { ok: true } | { ok: false; error: string };
export type UserActiveResult = { ok: true } | { ok: false; error: string };
export type CreateUserResult = { ok: true } | { ok: false; error: string };

/** Payload of the new-user form (NewUserModal). */
export interface NewUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  password: string;
}

interface MeResponse {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role_name: string | null;
  is_superuser: boolean;
}

interface BackendEmployee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role_id: number;
  role_name: string;
  is_active: boolean;
}

interface BackendRole {
  id: number;
  role_name: string;
}

const fullName = (first: string, last: string) => `${first} ${last}`.trim();

function meToUser(data: MeResponse): User {
  return {
    id: String(data.id),
    name: fullName(data.first_name, data.last_name),
    email: data.email,
    role: toUiRole(data.role_name, data.is_superuser),
    active: true,
    createdAt: "",
  };
}

function employeeToUser(data: BackendEmployee): User {
  return {
    id: String(data.id),
    name: fullName(data.first_name, data.last_name),
    email: data.email,
    role: toUiRole(data.role_name),
    active: data.is_active,
    createdAt: "",
  };
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const details = err.details;
  if (typeof details === "string" && details) return details;
  if (details && typeof details === "object") {
    const detail = (details as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    const flat = Object.values(details as Record<string, unknown>)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .map(String)
      .join(" ");
    if (flat) return flat;
  }
  return fallback;
}

/**
 * Owns login/logout, session restore and the user directory behind the Roles
 * screen. Authentication, the login lockout and every role or status change
 * are enforced server-side (Django session + apps.accounts); this hook only
 * reflects what the server decided. The client-side role checks below exist to
 * give a clear message before the request, never as the gate itself.
 */
export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [lockedUntilByEmail, setLockedUntilByEmail] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [backendRoles, setBackendRoles] = useState<BackendRole[]>([]);

  useEffect(() => {
    api
      .get<MeResponse>("/api/v1/accounts/me/")
      .then((data) => setCurrentUser(meToUser(data)))
      .catch(() => setCurrentUser(null))
      .finally(() => setIsRestoring(false));
  }, []);

  const mayManage = !!currentUser && canManageRoles(currentUser.role);

  const refreshUsers = useCallback(async () => {
    const [employees, roles] = await Promise.all([
      api.get<BackendEmployee[]>("/api/v1/accounts/employees/"),
      api.get<BackendRole[]>("/api/v1/accounts/roles/"),
    ]);
    setUsers(employees.map(employeeToUser));
    setBackendRoles(roles);
  }, []);

  // Only admin-tier sessions list employees; the server would 403 everyone else.
  useEffect(() => {
    if (!mayManage) return;
    let cancelled = false;
    Promise.all([
      api.get<BackendEmployee[]>("/api/v1/accounts/employees/"),
      api.get<BackendRole[]>("/api/v1/accounts/roles/"),
    ])
      .then(([employees, roles]) => {
        if (cancelled) return;
        setUsers(employees.map(employeeToUser));
        setBackendRoles(roles);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mayManage]);

  // Everyone else sees only their own row on the Roles screen.
  const directory = mayManage && users.length > 0 ? users : currentUser ? [currentUser] : [];

  /** Timestamp (ms) the given email is locked out until, or null if not locked. */
  const getLockedUntil = (email: string): number | null =>
    lockedUntilByEmail[email.trim().toLowerCase()] ?? null;

  const login = async ({ email, password }: LoginCredentials): Promise<LoginResult> => {
    const key = email.trim().toLowerCase();
    try {
      const data = await api.post<MeResponse>("/api/v1/accounts/login/", { email, password });
      setLockedUntilByEmail((prev) => {
        const rest = { ...prev };
        delete rest[key];
        return rest;
      });
      const user = meToUser(data);
      setCurrentUser(user);
      recordAuditEvent({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "auth.login.success",
        details: `${user.email} logged in`,
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const lockedUntil = (err.details as { locked_until?: number })?.locked_until;
        if (lockedUntil) setLockedUntilByEmail((prev) => ({ ...prev, [key]: lockedUntil }));
        recordAuditEvent({
          userId: null,
          userName: email.trim(),
          userRole: null,
          action: "auth.login.lockout",
          details: "Locked out after too many failed attempts",
        });
        return { ok: false, error: "Too many failed attempts. Please wait for the lockout to expire." };
      }
      // A request that never got an answer is not a wrong password.
      if (!(err instanceof ApiError)) {
        return { ok: false, error: "Can't reach the server. Check your connection and try again." };
      }
      recordAuditEvent({
        userId: null,
        userName: email.trim(),
        userRole: null,
        action: "auth.login.failure",
        details: "Failed login attempt",
      });
      return { ok: false, error: apiErrorMessage(err, "Invalid email or password.") };
    }
  };

  const logout = async () => {
    if (currentUser) {
      recordAuditEvent({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "auth.logout",
        details: `${currentUser.email} logged out`,
      });
    }
    try {
      await api.post("/api/v1/accounts/logout/", {});
    } finally {
      setCurrentUser(null);
      setUsers([]);
    }
  };

  /** Changes a user's role on behalf of the signed-in user. */
  const updateUserRole = async (userId: UserId, newRole: UserRole): Promise<RoleChangeResult> => {
    if (!currentUser) return { ok: false, error: "You must be signed in." };
    const target = users.find((u) => u.id === userId);
    if (!target) return { ok: false, error: "User not found." };
    if (target.role === newRole) return { ok: true };
    if (!canAssignRole(currentUser.role, target.role, newRole)) {
      return { ok: false, error: "You don't have permission to make this role change." };
    }
    const backendRole = backendRoles.find((r) => r.role_name === BACKEND_ROLE_BY_UI[newRole]);
    if (!backendRole) return { ok: false, error: `The ${roleLabel(newRole)} role does not exist on the server.` };

    try {
      const saved = await api.patch<BackendEmployee>(`/api/v1/accounts/employees/${userId}/`, {
        role_id: backendRole.id,
      });
      const updated = employeeToUser(saved);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      // Keep the signed-in session in step so permissions update immediately.
      if (currentUser.id === userId) setCurrentUser({ ...currentUser, role: updated.role });
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err, "Could not change this user's role.") };
    }

    recordAuditEvent({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: "user.role_changed",
      entityType: "User",
      entityId: userId,
      details: `Changed ${target.name}'s role from ${roleLabel(target.role)} to ${roleLabel(newRole)}`,
    });
    return { ok: true };
  };

  /** Creates a staff login (FR-3.10.1) with the backend role mapped from `input.role`. */
  const createUser = async (input: NewUserInput): Promise<CreateUserResult> => {
    if (!currentUser || !canAssignRole(currentUser.role, "cashier", input.role)) {
      return { ok: false, error: "You don't have permission to create this account." };
    }
    const backendRole = backendRoles.find((r) => r.role_name === BACKEND_ROLE_BY_UI[input.role]);
    if (!backendRole) {
      return { ok: false, error: `The ${roleLabel(input.role)} role does not exist on the server.` };
    }
    try {
      const saved = await api.post<BackendEmployee>("/api/v1/accounts/employees/", {
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        role_id: backendRole.id,
        password: input.password,
      });
      const created = employeeToUser(saved);
      setUsers((prev) => [...prev, created]);
      recordAuditEvent({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "user.created",
        entityType: "User",
        entityId: created.id,
        details: `Created ${created.name} (${created.email}) as ${roleLabel(created.role)}`,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err, "Could not create the account.") };
    }
  };

  /** Activates or deactivates a user's account on behalf of the signed-in user. */
  const setUserActive = async (userId: UserId, active: boolean): Promise<UserActiveResult> => {
    if (!currentUser) return { ok: false, error: "You must be signed in." };
    const target = users.find((u) => u.id === userId);
    if (!target) return { ok: false, error: "User not found." };
    if (target.active === active) return { ok: true };
    if (!canManageRoles(currentUser.role)) {
      return { ok: false, error: "You don't have permission to change account status." };
    }
    if (!active && currentUser.id === userId) {
      return { ok: false, error: "You cannot deactivate your own account." };
    }

    try {
      const saved = await api.post<BackendEmployee>(
        `/api/v1/accounts/employees/${userId}/${active ? "activate" : "deactivate"}/`,
        {}
      );
      const updated = employeeToUser(saved);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err, "Could not change this account's status.") };
    }

    recordAuditEvent({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: active ? "user.reactivated" : "user.deactivated",
      entityType: "User",
      entityId: userId,
      details: `${active ? "Reactivated" : "Deactivated"} ${target.name}'s account`,
    });
    return { ok: true };
  };

  return {
    users: directory,
    currentUser,
    isRestoring,
    login,
    logout,
    getLockedUntil,
    updateUserRole,
    setUserActive,
    createUser,
    refreshUsers,
  };
}

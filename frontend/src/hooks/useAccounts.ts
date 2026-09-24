import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Account, AccountInput, AccountRole } from "../types/domain";

interface BackendEmployee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  role_id: number;
  role_name: Account["roleName"];
  is_active: boolean;
}

interface BackendRole {
  id: number;
  role_name: Account["roleName"];
}

function toAccount(employee: BackendEmployee): Account {
  return {
    id: String(employee.id),
    firstName: employee.first_name,
    lastName: employee.last_name,
    email: employee.email,
    phone: employee.phone,
    roleId: employee.role_id,
    roleName: employee.role_name,
    active: employee.is_active,
  };
}

/**
 * Owns FR-3.10.1 (Owner/Admin creates, edits, deactivates and assigns roles
 * to user accounts). The list, create and edit calls all go through
 * /api/v1/accounts/employees/, which the server rejects for anyone whose
 * role wasn't granted accounts.manage — this hook has no client-side
 * gatekeeping of its own to bypass.
 */
export function useAccounts(enabled: boolean) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [roles, setRoles] = useState<AccountRole[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  useEffect(() => {
    // Staff hold no accounts.manage permission — skip the calls the server
    // would just 403 rather than firing them (and logging the noise) anyway.
    if (!enabled) return;
    let cancelled = false;
    Promise.all([
      api.get<BackendEmployee[]>("/api/v1/accounts/employees/"),
      api.get<BackendRole[]>("/api/v1/accounts/roles/"),
    ])
      .then(([employees, backendRoles]) => {
        if (cancelled) return;
        setAccounts(employees.map(toAccount));
        setRoles(backendRoles.map((role) => ({ id: role.id, name: role.role_name })));
      })
      .catch((requestError: Error) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const saveAccount = async (input: AccountInput) => {
    const payload = {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      role_id: input.roleId,
      ...(input.password ? { password: input.password } : {}),
    };
    try {
      const saved = input.id
        ? await api.patch<BackendEmployee>(`/api/v1/accounts/employees/${input.id}/`, payload)
        : await api.post<BackendEmployee>("/api/v1/accounts/employees/", payload);
      setAccounts((prev) => {
        const mapped = toAccount(saved);
        return input.id ? prev.map((a) => (a.id === mapped.id ? mapped : a)) : [...prev, mapped];
      });
      setError(null);
      setEditingAccount(null);
      setIsCreatingAccount(false);
      return { ok: true } as const;
    } catch (err) {
      const detail =
        err instanceof ApiError
          ? Object.values(err.details as Record<string, string[]>)
              .flat()
              .join(" ") || "Could not save account."
          : "Could not save account.";
      return { ok: false, error: detail } as const;
    }
  };

  const setAccountActive = async (id: string, active: boolean) => {
    const action = active ? "activate" : "deactivate";
    const updated = await api.post<BackendEmployee>(`/api/v1/accounts/employees/${id}/${action}/`, {});
    setAccounts((prev) => prev.map((a) => (a.id === id ? toAccount(updated) : a)));
  };

  const cancelAccountEdit = () => {
    setEditingAccount(null);
    setIsCreatingAccount(false);
  };

  return {
    accounts,
    roles,
    isLoading,
    error,
    editingAccount,
    setEditingAccount,
    isCreatingAccount,
    setIsCreatingAccount,
    saveAccount,
    setAccountActive,
    cancelAccountEdit,
  };
}

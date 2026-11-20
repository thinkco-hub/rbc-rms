import React, { useId, useState } from "react";
import type { FormEvent } from "react";
import Modal from "../common/Modal";
import { ALL_ROLES, ROLE_LABELS, canAssignRole } from "../../utils/permissions";
import type { NewUserInput } from "../../hooks/useAuth";
import type { UserRole } from "../../types/domain";

interface NewUserModalProps {
  actorRole: UserRole;
  onClose: () => void;
  onCreate: (input: NewUserInput) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const FIELD =
  "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800";

/** Creates a staff login (FR-3.10.1). The server re-checks accounts.manage. */
export default function NewUserModal({ actorRole, onClose, onCreate }: NewUserModalProps) {
  const headingId = useId();
  // A new account starts from the lowest role, so the same rule as a role change applies.
  const assignable = ALL_ROLES.filter((role) => canAssignRole(actorRole, "cashier", role));
  const [form, setForm] = useState<NewUserInput>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: assignable[0] ?? "cashier",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof NewUserInput, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      setError("First name, last name, email and password are required.");
      return;
    }
    setSubmitting(true);
    const result = await onCreate(form);
    setSubmitting(false);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <Modal
      labelledBy={headingId}
      onClose={onClose}
      overlayClassName="z-[100] bg-black/50 backdrop-blur-sm px-4"
      className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fadeIn"
    >
      <form onSubmit={handleSubmit}>
        <h2 id={headingId} className="text-2xl font-bold text-[#121212] mb-1">
          New User
        </h2>
        <p className="text-gray-500 text-sm mb-6">Create a login for a staff member.</p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-gray-700">
              First Name
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                className={`${FIELD} mt-1 font-normal`}
                required
              />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Last Name
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                className={`${FIELD} mt-1 font-normal`}
                required
              />
            </label>
          </div>
          <label className="block text-sm font-semibold text-gray-700">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={`${FIELD} mt-1 font-normal`}
              required
            />
          </label>
          <label className="block text-sm font-semibold text-gray-700">
            Phone
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className={`${FIELD} mt-1 font-normal`}
            />
          </label>
          <label className="block text-sm font-semibold text-gray-700">
            Role
            <select
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              className={`${FIELD} mt-1 font-normal bg-white`}
            >
              {assignable.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-gray-700">
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className={`${FIELD} mt-1 font-normal`}
              autoComplete="new-password"
              required
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-3 rounded-xl text-white font-bold bg-[var(--color-brand-strong)] hover:bg-[var(--color-brand-strong-hover)] transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Create User"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

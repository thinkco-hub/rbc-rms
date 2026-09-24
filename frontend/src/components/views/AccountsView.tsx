import React from "react";
import AccountEditorModal from "../accounts/AccountEditorModal";
import type { Account, AccountInput, AccountRole } from "../../types/domain";

interface AccountsViewProps {
  accounts: Account[];
  roles: AccountRole[];
  isLoading: boolean;
  error: string | null;
  editingAccount: Account | null;
  isCreatingAccount: boolean;
  onEdit: (account: Account | null) => void;
  onCreate: () => void;
  onCancelEdit: () => void;
  onSave: (data: AccountInput) => Promise<{ ok: boolean; error?: string }>;
  onSetActive: (id: string, active: boolean) => void;
}

export default function AccountsView({
  accounts,
  roles,
  isLoading,
  error,
  editingAccount,
  isCreatingAccount,
  onEdit,
  onCreate,
  onCancelEdit,
  onSave,
  onSetActive,
}: AccountsViewProps) {
  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#121212]">User Accounts</h2>
          <p className="text-gray-500 mt-1">
            Create, edit, deactivate and assign roles to staff accounts.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="px-4 py-2.5 rounded-lg bg-[#562D07] hover:bg-[#3a1d04] text-white font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
        >
          + New Account
        </button>
      </header>

      {error && (
        <p className="mb-4 text-sm font-semibold text-red-600">{error}</p>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-4 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Loading accounts...
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No accounts yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 font-semibold text-[#121212]">
                      {account.firstName} {account.lastName}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{account.email}</td>
                    <td className="px-6 py-4 text-gray-600">{account.roleName}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          account.active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {account.active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onEdit(account)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#562D07] hover:bg-[#F3B978]/20 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onSetActive(account.id, !account.active)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            account.active
                              ? "text-red-600 hover:bg-red-50"
                              : "text-green-700 hover:bg-green-50"
                          }`}
                        >
                          {account.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(isCreatingAccount || editingAccount) && (
        <AccountEditorModal
          account={editingAccount}
          roles={roles}
          onCancel={onCancelEdit}
          onSave={onSave}
        />
      )}
    </div>
  );
}

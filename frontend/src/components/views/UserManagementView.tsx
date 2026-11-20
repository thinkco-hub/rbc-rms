import { useState } from "react";
import SelectField from "../common/SelectField";
import DeleteConfirmDialog from "../common/DeleteConfirmDialog";
import SearchField from "../common/SearchField";
import { ALL_ROLES, ROLE_LABELS, canAssignRole, canManageRoles } from "../../utils/permissions";
import NewUserModal from "./NewUserModal";
import type {
  CreateUserResult,
  NewUserInput,
  RoleChangeResult,
  UserActiveResult,
} from "../../hooks/useAuth";
import type { User, UserId, UserRole } from "../../types/domain";

interface UserManagementViewProps {
  users: User[];
  currentUser: User;
  onChangeRole: (userId: UserId, newRole: UserRole) => Promise<RoleChangeResult>;
  onSetActive: (userId: UserId, active: boolean) => Promise<UserActiveResult>;
  onCreateUser?: (input: NewUserInput) => Promise<CreateUserResult>;
}

interface Feedback {
  type: "success" | "error";
  message: string;
}

export default function UserManagementView({
  users,
  currentUser,
  onChangeRole,
  onSetActive,
  onCreateUser,
}: UserManagementViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const mayManage = canManageRoles(currentUser.role);

  const activeUsers = users.filter((u) => u.active);

  const query = search.trim().toLowerCase();
  const filteredUsers = query
    ? users.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          ROLE_LABELS[user.role].toLowerCase().includes(query)
      )
    : users;

  const handleChange = async (user: User, newRole: UserRole) => {
    const result = await onChangeRole(user.id, newRole);
    setFeedback(
      result.ok
        ? { type: "success", message: `${user.name} is now ${ROLE_LABELS[newRole]}.` }
        : { type: "error", message: result.error }
    );
  };

  const handleSetActive = async (user: User, active: boolean) => {
    const result = await onSetActive(user.id, active);
    setFeedback(
      result.ok
        ? {
            type: "success",
            message: active
              ? `${user.name}'s account has been reactivated.`
              : `${user.name}'s account has been deactivated.`
          }
        : { type: "error", message: result.error }
    );
  };

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#121212]">Roles</h2>
          <p className="text-gray-500 mt-1">
            Assign roles and manage account status. A role controls which views a user can open.
          </p>
        </div>
        {onCreateUser && mayManage && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2.5 rounded-lg bg-[var(--color-brand-strong)] hover:bg-[var(--color-brand-strong-hover)] text-white font-bold transition-colors"
          >
            + New User
          </button>
        )}
      </header>

      {isCreating && onCreateUser && (
        <NewUserModal
          actorRole={currentUser.role}
          onClose={() => setIsCreating(false)}
          onCreate={async (input) => {
            const result = await onCreateUser(input);
            if (result.ok) {
              setFeedback({ type: "success", message: `${input.firstName} ${input.lastName}'s account was created.` });
            }
            return result;
          }}
        />
      )}

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium border ${
            feedback.type === "error"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-green-50 text-green-700 border-green-200"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <p className="text-sm text-gray-500 mb-3">
        {query
          ? `${filteredUsers.length} of ${users.length} ${users.length === 1 ? "user" : "users"} shown`
          : `${activeUsers.length} active ${activeUsers.length === 1 ? "user" : "users"}`}
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-2 mb-4 flex shadow-sm">
        <SearchField
          value={search}
          onChange={setSearch}
          ariaLabel="Search users by name, email or role"
          placeholder="Search name, email or role..."
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
                <th scope="col" className="px-6 py-4">User</th>
                <th scope="col" className="px-6 py-4">Email</th>
                <th scope="col" className="px-6 py-4">Role</th>
                <th scope="col" className="px-6 py-4">Status</th>
                <th scope="col" className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No users.
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No users match your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const options = ALL_ROLES.map((role) => ({
                    role,
                    allowed:
                      role === user.role || canAssignRole(currentUser.role, user.role, role),
                  }));
                  const locked = options.every((o) => o.role === user.role || !o.allowed);

                  return (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <th scope="row" className="px-6 py-4 text-left font-normal">
                        <span className="font-medium text-gray-900">{user.name}</span>
                        {user.id === currentUser.id && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-[#562D07]">
                            You
                          </span>
                        )}
                      </th>
                      <td className="px-6 py-4 text-gray-600">{user.email}</td>
                      <td className="px-6 py-4">
                        <SelectField
                          value={user.role}
                          disabled={locked}
                          onChange={(e) => handleChange(user, e.target.value as UserRole)}
                          aria-label={`Role for ${user.name}`}
                          title={
                            locked
                              ? "Only a Super Admin can change this user's role"
                              : undefined
                          }
                          className="pl-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm text-gray-800 focus:ring-1 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {options.map(({ role, allowed }) => (
                            <option key={role} value={role} disabled={!allowed}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </SelectField>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            user.active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {user.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() =>
                            user.active
                              ? setPendingDeactivate(user)
                              : handleSetActive(user, true)
                          }
                          disabled={!mayManage || user.id === currentUser.id}
                          aria-label={`${user.active ? "Deactivate" : "Reactivate"} ${user.name}`}
                          title={
                            !mayManage
                              ? "You don't have permission to change account status"
                              : user.id === currentUser.id
                                ? "You cannot deactivate your own account"
                                : undefined
                          }
                          className={`font-semibold px-3 py-1.5 rounded-md transition-colors text-sm disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                            user.active
                              ? "text-red-700 hover:bg-red-50"
                              : "text-green-700 hover:bg-green-50"
                          }`}
                        >
                          {user.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pendingDeactivate && (
        <DeleteConfirmDialog
          title="Deactivate this account?"
          message={`Deactivating ${pendingDeactivate.name} (${pendingDeactivate.email}) blocks their sign-in until the account is reactivated. The account and its audit history are kept.`}
          confirmLabel="Deactivate"
          onConfirm={() => {
            handleSetActive(pendingDeactivate, false);
            setPendingDeactivate(null);
          }}
          onCancel={() => setPendingDeactivate(null)}
        />
      )}
    </div>
  );
}

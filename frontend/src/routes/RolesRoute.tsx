import React from "react";
import UserManagementView from "../components/views/UserManagementView";
import { RequireTab } from "../components/RequireAccess";
import { useShell } from "./shell";

export default function RolesRoute() {
  const { currentUser, users, updateUserRole, setUserActive, createUser } = useShell();

  return (
    <RequireTab role={currentUser.role} tab="user-management">
      <UserManagementView
        users={users}
        currentUser={currentUser}
        onChangeRole={updateUserRole}
        onSetActive={setUserActive}
        onCreateUser={createUser}
      />
    </RequireTab>
  );
}

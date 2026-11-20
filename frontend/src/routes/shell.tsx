import { createContext, useContext } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type {
  CreateUserResult,
  NewUserInput,
  RoleChangeResult,
  UserActiveResult,
} from "../hooks/useAuth";
import type { NavTabId, User, UserId, UserRole } from "../types/domain";

/**
 * The shell-level services a route module needs but must not create for itself:
 * the signed-in session (useAuth is not a context, so a second instance would be
 * a separate signed-out session) and navigation (the back rule depends on where
 * this browser session entered the app, which only the layout knows).
 */
export interface ShellContextValue {
  currentUser: User;
  users: User[];
  updateUserRole: (userId: UserId, newRole: UserRole) => Promise<RoleChangeResult>;
  setUserActive: (userId: UserId, active: boolean) => Promise<UserActiveResult>;
  createUser: (input: NewUserInput) => Promise<CreateUserResult>;
  logout: () => void;
  activeTab: NavTabId | null;
  backToList: (listPath: string) => void;
  goToTab: (tab: NavTabId) => void;
  openPath: (path: string, options?: { replace?: boolean }) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
  isInventoryExpanded: boolean;
  setIsInventoryExpanded: Dispatch<SetStateAction<boolean | null>>;
  isReportsExpanded: boolean;
  setIsReportsExpanded: Dispatch<SetStateAction<boolean | null>>;
  windowWidth: number;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({
  value,
  children,
}: {
  value: ShellContextValue;
  children: ReactNode;
}) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("useShell must be used inside ShellProvider");
  return shell;
}

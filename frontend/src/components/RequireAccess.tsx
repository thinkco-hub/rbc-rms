import React from "react";
import { Navigate } from "react-router";
import { PATH_BY_TAB } from "../routes";
import { DEFAULT_TAB, canAccessChams, canAccessTab } from "../utils/permissions";
import type { NavTabId, UserRole } from "../types/domain";

/**
 * Route-level access guards. A denied route bounces to the default tab, and
 * every role can open `dashboard` (`ROLE_TABS`), so a denial always lands and
 * cannot loop. They re-evaluate on every render, so a role changed from the
 * Roles screen bounces the affected session with no reload.
 *
 * `role` is passed down from App rather than read with `useAuth()` here.
 * `useAuth` is plain `useState`, not a context, so a second instance below the
 * outlet would be its own permanently signed-out session — and every route these
 * guards wrapped would then deny.
 */

interface RequireTabProps {
  role: UserRole | undefined;
  tab: NavTabId;
  children: React.ReactNode;
}

/** Renders `children` only while `canAccessTab(role, tab)` holds. */
export function RequireTab({ role, tab, children }: RequireTabProps) {
  if (!role || !canAccessTab(role, tab)) {
    return <Navigate to={PATH_BY_TAB[DEFAULT_TAB]} replace />;
  }
  return <>{children}</>;
}

interface RequireChamsProps {
  role: UserRole | undefined;
  children: React.ReactNode;
}

/** The Chams ledger has its own rule and guard: chams is not a `NavTabId`. */
export function RequireChams({ role, children }: RequireChamsProps) {
  if (!role || !canAccessChams(role)) {
    return <Navigate to={PATH_BY_TAB[DEFAULT_TAB]} replace />;
  }
  return <>{children}</>;
}

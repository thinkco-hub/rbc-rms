import { useId, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import type { User } from "../../types/domain";
import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  canAccessChams,
  canAccessReconciliation,
  canAccessTab,
} from "../../utils/permissions";
import { canUseSidebarRail } from "../../utils/responsive";
import { useDrawerA11y } from "../../hooks/useDrawerA11y";
import { CHAMS_PATH, PATH_BY_TAB, isWithinPath } from "../../routes";

interface SidebarProps {
  currentUser: User;
  onLogout: () => void;
  windowWidth: number;
  isSidebarOpen: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
  /** The hamburger in the top bar; focus returns to it when the drawer closes. */
  triggerRef: RefObject<HTMLButtonElement>;
  isInventoryExpanded: boolean;
  /** null hands the group back to the route it owns. */
  setIsInventoryExpanded: Dispatch<SetStateAction<boolean | null>>;
  isReportsExpanded: boolean;
  /** null hands the group back to the route it owns. */
  setIsReportsExpanded: Dispatch<SetStateAction<boolean | null>>;
  /** Closes the phone drawer once a link is chosen; the URL is the state. */
  onNavSelect: () => void;
}

/** A top-level item; `extra` carries the group headers' justify-between. */
function itemCls(active: boolean, extra = "") {
  return `w-full flex items-center ${extra} p-3 rounded-lg font-bold transition-colors whitespace-nowrap overflow-hidden ${
    active
      ? "bg-[#F3B978]/20 text-white shadow-md border-l-4 border-[#F17D0C]"
      : "text-[#FDF9F3]/60 hover:bg-[#F3B978]/10 hover:text-white border-l-4 border-transparent"
  }`;
}

function subItemCls(active: boolean) {
  // block: these are router links now, and an inline anchor ignores w-full/py.
  return `w-full block text-left pl-14 py-2.5 text-sm font-medium transition-colors ${
    active
      ? "text-[#F17D0C] bg-[#3a1d04] border-l-2 border-[#F17D0C]"
      : "text-[#FDF9F3]/70 hover:text-white hover:bg-[#3a1d04] border-l-2 border-transparent"
  }`;
}

export default function Sidebar({
  currentUser,
  onLogout,
  windowWidth,
  isSidebarOpen,
  setIsSidebarOpen,
  triggerRef,
  isInventoryExpanded,
  setIsInventoryExpanded,
  isReportsExpanded,
  setIsReportsExpanded,
  onNavSelect,
}: SidebarProps) {
  // --- ROLE-BASED VISIBILITY (src/utils/permissions.ts) ---
  const role = currentUser.role;
  const canReconcile = canAccessReconciliation(role);
  const canSwitchToChams = canAccessChams(role);

  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Neither group header is a link that could ask NavLink for isActive: Reports
  // only expands, and the Inventory row is a link beside a separate toggle.
  const isReportsActive = isWithinPath(PATH_BY_TAB["reports-dashboard"], pathname);
  const isInventoryActive = isWithinPath(PATH_BY_TAB.inventory, pathname);
  const inventorySubmenuId = useId();
  const reportsSubmenuId = useId();

  // --- SIDEBAR RESPONSIVE HELPERS ---
  // Phones and tablets open the sidebar from the hamburger as an off-canvas
  // drawer. Only a mouse-driven viewport gets the pinned rail, because the rail
  // relies on hover to reveal its labels.
  const isDesktopRail = canUseSidebarRail(windowWidth);

  // Desktop rail: expanded while the pointer is anywhere inside the panel or
  // focus is inside it, collapsed once both leave. Testing clientX against the
  // collapsed width instead collapses the rail under its own labels and
  // chevrons, putting the right half of the open rail out of mouse reach.
  const [isRailPointerInside, setIsRailPointerInside] = useState(false);
  const [isRailFocusInside, setIsRailFocusInside] = useState(false);
  // Focus pins the rail open only for keyboard users: a mouse click leaves
  // focus on the row too, and pinning that would keep the overlay covering
  // content after the cursor has left.
  const railInputModality = useRef<"pointer" | "keyboard">("keyboard");
  const desktopRailExpanded =
    isDesktopRail && (isRailPointerInside || isRailFocusInside);
  const collapseRail = () => {
    setIsRailPointerInside(false);
    setIsRailFocusInside(false);
  };

  // Shared class for sidebar labels/chevrons: always shown in the drawer, hidden
  // on the collapsed desktop rail until hover expands it.
  const sidebarLabelCls =
    !isDesktopRail || desktopRailExpanded ? "opacity-100" : "opacity-0";

  // Sub-menus stay mounted so their toggle's aria-controls always resolves, and
  // `hidden` is what takes a collapsed one out of the tab order. The collapsed
  // desktop rail has no room for a sub-menu at all.
  const submenuHidden = isDesktopRail && !desktopRailExpanded;

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerA11y = useDrawerA11y({
    containerRef: drawerRef,
    triggerRef,
    closeRef,
    isOpen: isSidebarOpen,
    isDrawerLayout: !isDesktopRail,
    onClose: () => setIsSidebarOpen(false),
  });

  return (
    <>
      {/* DRAWER OVERLAY — tap outside the open sidebar to dismiss it */}
      {isSidebarOpen && !isDesktopRail && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Fixed gutter: the rail grows over it as an overlay, so the content
          beside it never moves while the rail opens or closes. */}
      {isDesktopRail && <div className="w-20 flex-shrink-0" aria-hidden="true" />}

      {/* RAIL SCRIM — the drawer's dismiss veil, for the open rail */}
      {isDesktopRail && desktopRailExpanded && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={collapseRail}
        />
      )}

      {/* SIDEBAR */}
      <div
        ref={drawerRef}
        {...drawerA11y}
        onMouseDown={() => {
          railInputModality.current = "pointer";
        }}
        onMouseEnter={() => {
          if (isDesktopRail) setIsRailPointerInside(true);
        }}
        onMouseLeave={() => {
          if (isDesktopRail) setIsRailPointerInside(false);
        }}
        onKeyDown={(e) => {
          railInputModality.current = "keyboard";
          drawerA11y.onKeyDown?.(e);
        }}
        onFocus={() => {
          if (isDesktopRail && railInputModality.current === "keyboard") {
            setIsRailFocusInside(true);
          }
        }}
        onBlur={(e) => {
          if (isDesktopRail && !e.currentTarget.contains(e.relatedTarget)) {
            setIsRailFocusInside(false);
          }
        }}
        className={`
        inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out flex flex-col
        bg-[#562D07] text-[#FDF9F3] shadow-2xl
        ${
          isDesktopRail
            ? // Same 300ms ease-in-out growth as the Chams rail, but absolute
              // over the gutter so only the sidebar moves.
              `absolute ${desktopRailExpanded ? "w-64" : "w-20"}`
            : // Drawer = fixed, so the page keeps its full width underneath it
              `fixed w-64 ${
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`
        }
      `}
      >
        {/* Brand Area */}
        <div
          className={`p-5 border-b border-[#F3B978]/20 flex justify-between items-center whitespace-nowrap overflow-hidden ${
            isDesktopRail ? "h-[76px]" : ""
          }`}
        >
          <button
            onClick={() => navigate(CHAMS_PATH)}
            disabled={!canSwitchToChams}
            className={`flex items-center ${canSwitchToChams ? "" : "cursor-default"}`}
            title={canSwitchToChams ? "Switch to Chams Branch Stock Ledger" : undefined}
          >
            <div className="w-10 h-10 bg-white rounded-full flex flex-shrink-0 items-center justify-center mr-4 p-1 shadow-inner">
              <span className="text-[#562D07] font-bold text-xs text-center leading-tight">
                RBC
                <br />
                <span className="text-[6px]">BAKERY</span>
              </span>
            </div>
            <span
              className={`text-xl font-bold ${sidebarLabelCls} transition-opacity duration-300 ease-in-out`}
            >
              Bakery HQ
            </span>
          </button>
          {!isDesktopRail && (
            <button
              ref={closeRef}
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close navigation"
              className="p-1 text-[#FDF9F3]/60 hover:text-white"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-3 space-y-3 mt-4 overflow-y-auto hide-scrollbar">
          {canAccessTab(role, "dashboard") && (
            <NavLink
              to={PATH_BY_TAB.dashboard}
              end
              onClick={onNavSelect}
              className={({ isActive }) => itemCls(isActive)}
            >
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </div>
              <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
                Dashboard
              </span>
            </NavLink>
          )}

          {canAccessTab(role, "pos") && (
            <NavLink
              to={PATH_BY_TAB.pos}
              end
              onClick={onNavSelect}
              className={({ isActive }) => itemCls(isActive)}
            >
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </div>
              <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
                Point of Sale
              </span>
            </NavLink>
          )}

          {canAccessTab(role, "orders") && (
            <NavLink
              to={PATH_BY_TAB.orders}
              onClick={onNavSelect}
              className={({ isActive }) => itemCls(isActive)}
            >
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6h-2c0-2.8-2.2-5-5-5S7 3.2 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.7 0 3 1.3 3 3H9c0-1.7 1.3-3 3-3zm7 17H5V8h14v12zm-7-8c-1.7 0-3-1.3-3-3H7c0 2.8 2.2 5 5 5s5-2.2 5-5h-2c0 1.7-1.3 3-3 3z" />
                </svg>
              </div>
              <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
                Orders
              </span>
            </NavLink>
          )}

          {canAccessTab(role, "clients") && (
            <NavLink
              to={PATH_BY_TAB.clients}
              onClick={onNavSelect}
              className={({ isActive }) => itemCls(isActive)}
            >
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 10-8 0 4 4 0 008 0zm6 3a4 4 0 10-8 0 4 4 0 008 0z"
                  />
                </svg>
              </div>
              <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
                Clients
              </span>
            </NavLink>
          )}

          {canAccessTab(role, "inventory") && (
            <div className="flex flex-col">
              <div className={itemCls(isInventoryActive)}>
                <NavLink
                  to={PATH_BY_TAB.inventory}
                  onClick={onNavSelect}
                  className="flex items-center min-w-0 flex-1"
                >
                  <div className="flex items-center justify-center w-8 flex-shrink-0">
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18.21 0-.41-.06-.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zM19 15.91v-6.7l-6 3.37v6.71l6-3.38z" />
                    </svg>
                  </div>
                  <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
                    Inventory
                  </span>
                </NavLink>
                {/* No toggle on the collapsed rail: its labels are invisible there. */}
                {canReconcile && !submenuHidden && (
                  <button
                    onClick={() => setIsInventoryExpanded(!isInventoryExpanded)}
                    aria-label="Toggle inventory submenu"
                    aria-expanded={isInventoryExpanded}
                    aria-controls={inventorySubmenuId}
                    // Negative margins keep the chevron in place; the target is 40px.
                    className="-my-3 -mr-3 ml-2 p-3 flex-shrink-0"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isInventoryExpanded ? "rotate-180" : ""
                      } ${sidebarLabelCls}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {canReconcile && (
                <div
                  id={inventorySubmenuId}
                  hidden={submenuHidden || !isInventoryExpanded}
                  className="mt-1 space-y-1 bg-[#4a2605] rounded-lg overflow-hidden transition-all shadow-inner"
                >
                  <NavLink
                    to={PATH_BY_TAB["inventory-reconciliation"]}
                    end
                    onClick={onNavSelect}
                    className={({ isActive }) => subItemCls(isActive)}
                  >
                    Reconciliation
                  </NavLink>
                </div>
              )}
            </div>
          )}

          {canAccessTab(role, "recipes") && (
            <NavLink
              to={PATH_BY_TAB.recipes}
              onClick={onNavSelect}
              className={({ isActive }) => itemCls(isActive)}
            >
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
                Recipes
              </span>
            </NavLink>
          )}

          {canAccessTab(role, "production-runs") && (
            <NavLink
              to={PATH_BY_TAB["production-runs"]}
              end
              onClick={onNavSelect}
              className={({ isActive }) => itemCls(isActive)}
            >
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 3v2m6-2v2M4 8h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1zm3 8l2.5 2.5L15 12"
                  />
                </svg>
              </div>
              <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
                Production Runs
              </span>
            </NavLink>
          )}

          {canAccessTab(role, "calendar") && (
            <NavLink
              to={PATH_BY_TAB.calendar}
              end
              onClick={onNavSelect}
              className={({ isActive }) => itemCls(isActive)}
            >
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z" />
                </svg>
              </div>
              <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
                Calendar
              </span>
            </NavLink>
          )}

          {canAccessTab(role, "reports-dashboard") && (
            <div className="flex flex-col">
              <button
                onClick={() => setIsReportsExpanded(!isReportsExpanded)}
                aria-expanded={isReportsExpanded}
                aria-controls={reportsSubmenuId}
                className={itemCls(isReportsActive, "justify-between")}
              >
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-8 flex-shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
                    Reports
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 ml-2 transition-transform duration-200 ${
                    isReportsExpanded ? "rotate-180" : ""
                  } ${sidebarLabelCls}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div
                id={reportsSubmenuId}
                hidden={submenuHidden || !isReportsExpanded}
                className="mt-1 space-y-1 bg-[#4a2605] rounded-lg overflow-hidden transition-all shadow-inner"
              >
                <NavLink
                  to={PATH_BY_TAB["reports-dashboard"]}
                  end
                  onClick={onNavSelect}
                  className={({ isActive }) => subItemCls(isActive)}
                >
                  Sales Dashboard
                </NavLink>
                <NavLink
                  to={PATH_BY_TAB["reports-closing"]}
                  end
                  onClick={onNavSelect}
                  className={({ isActive }) => subItemCls(isActive)}
                >
                  End-of-Day Closing
                </NavLink>
                <NavLink
                  to={PATH_BY_TAB["reports-inventory"]}
                  end
                  onClick={onNavSelect}
                  className={({ isActive }) => subItemCls(isActive)}
                >
                  Closing Inventory
                </NavLink>
              </div>
            </div>
          )}

          {canAccessTab(role, "audit-logs") && (
            <NavLink
              to={PATH_BY_TAB["audit-logs"]}
              end
              onClick={onNavSelect}
              className={({ isActive }) => itemCls(isActive)}
            >
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
                Audit Logs
              </span>
            </NavLink>
          )}

          {canAccessTab(role, "user-management") && (
            <NavLink
              to={PATH_BY_TAB["user-management"]}
              end
              onClick={onNavSelect}
              className={({ isActive }) => itemCls(isActive)}
            >
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
                Roles
              </span>
            </NavLink>
          )}
        </nav>

        {/* Bottom Logout Area */}
        <div className="p-3 mb-4 mt-auto border-t border-[#F3B978]/20 pt-4">
          <div
            className={`px-3 mb-2 overflow-hidden whitespace-nowrap ${sidebarLabelCls} transition-opacity duration-300`}
          >
            <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
            <p className="text-xs text-[#FDF9F3]/70 truncate">{currentUser.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center p-3 rounded-lg font-bold text-[#FDF9F3]/60 hover:text-white hover:bg-[#F3B978]/10 transition-colors whitespace-nowrap overflow-hidden"
          >
            <div className="flex items-center justify-center w-8 flex-shrink-0">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </div>
            <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
              Log Out
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

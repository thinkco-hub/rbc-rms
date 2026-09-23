import { useState } from "react";
import type { AppView, NavTabId, User } from "../../types/domain";
import type { Dispatch, SetStateAction } from "react";

interface SidebarProps {
  activeTab: NavTabId;
  currentUser: User;
  onLogout: () => void;
  windowWidth: number;
  isMobileOpen: boolean;
  isTabletSidebarOpen: boolean;
  setIsMobileOpen: Dispatch<SetStateAction<boolean>>;
  setIsTabletSidebarOpen: Dispatch<SetStateAction<boolean>>;
  isInventoryExpanded: boolean;
  setIsInventoryExpanded: Dispatch<SetStateAction<boolean>>;
  isReportsExpanded: boolean;
  setIsReportsExpanded: Dispatch<SetStateAction<boolean>>;
  onNavClick: (tab: NavTabId) => void;
  onSwitchView: (view: AppView) => void;
  /** Whether the signed-in user is an admin (admin UX is TBD). */
  isAdmin: boolean;
}

/** Width (px) of the collapsed sidebar rail = desktop hover zone (Tailwind w-20). */
const COLLAPSED_RAIL_PX = 80;

export default function Sidebar({
  activeTab,
  currentUser,
  onLogout,
  windowWidth,
  isMobileOpen,
  isTabletSidebarOpen,
  setIsMobileOpen,
  setIsTabletSidebarOpen,
  isInventoryExpanded,
  setIsInventoryExpanded,
  isReportsExpanded,
  setIsReportsExpanded,
  onNavClick,
  onSwitchView,
  isAdmin,
}: SidebarProps) {
  // --- SIDEBAR RESPONSIVE HELPERS ---
  // "Tablet" = md..lg range (768px - 1023px), same cutoff the POS cart width uses.
  // Touch devices can't hover, so the sidebar rail toggles on click instead.
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const sidebarExpanded = isTablet && isTabletSidebarOpen;

  // Desktop (lg+): expand ONLY while the cursor is within the collapsed rail's
  // 80px width. Hovering the expanded part of the rail collapses it again, so
  // the rail can never "trap" the cursor and cover content sitting right next
  // to it (e.g. the POS category chips near the left edge).
  const isDesktop = windowWidth >= 1024;
  const [isDesktopRailHovered, setIsDesktopRailHovered] = useState(false);
  const desktopRailExpanded = isDesktop && isDesktopRailHovered;

  // Shared class for sidebar labels/chevrons: visible while the tablet rail is
  // expanded (click), while the desktop rail is hover-expanded, or on desktop
  // hover; hidden on the collapsed tablet rail.
  const sidebarLabelCls = sidebarExpanded
    ? "opacity-100"
    : desktopRailExpanded
      ? "opacity-100"
      : "opacity-100 md:opacity-0 lg:opacity-0";

  return (
    <>
      {/* MOBILE OVERLAY */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* TABLET SIDEBAR BACKDROP — click outside the expanded rail to close it */}
      {sidebarExpanded && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsTabletSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        onMouseMove={(e) => {
          if (!isDesktop) return;
          // Expand only while the cursor is inside the collapsed rail's 80px.
          setIsDesktopRailHovered(e.clientX < COLLAPSED_RAIL_PX);
        }}
        onMouseLeave={() => {
          if (isDesktop) setIsDesktopRailHovered(false);
        }}
        onClick={(e) => {
          if (!isTablet) return;
          // When expanded, only bare spots toggle the rail — button taps keep working
          if (sidebarExpanded && (e.target as HTMLElement).closest("button")) return;
          setIsTabletSidebarOpen((prev) => !prev);
        }}
        className={`
        fixed md:relative inset-y-0 left-0 z-50
        transform ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0
        w-64 ${sidebarExpanded ? "md:w-64" : "md:w-20"} ${
          desktopRailExpanded
            ? // Expanded = overlay so content never shifts; smooth 300ms growth
              "lg:w-64 lg:absolute"
            : // Collapsed = quick 150ms ease-back so the rail doesn't linger
              // over the POS chips after the cursor crosses the 80px line,
              // while still animating smoothly instead of snapping shut
              "lg:w-20 lg:duration-150"
        }
        transition-all duration-300 ease-in-out
        bg-[#562D07] text-[#FDF9F3] flex flex-col shadow-2xl
      `}
      >
        {/* Brand Area */}
        <div className="p-5 border-b border-[#F3B978]/20 flex justify-between items-center whitespace-nowrap md:h-[76px] overflow-hidden">
          <button
            onClick={() => onSwitchView("chams")}
            className="flex items-center"
            title="Switch to Chams Branch Stock Ledger"
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
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1 text-[#FDF9F3]/60 hover:text-white"
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
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-3 space-y-3 mt-4 overflow-y-auto hide-scrollbar">
          <button
            onClick={() => onNavClick("dashboard")}
            className={`w-full flex items-center p-3 rounded-lg font-bold transition-colors whitespace-nowrap overflow-hidden ${
              activeTab === "dashboard"
                ? "bg-[#F3B978]/20 text-white shadow-md border-l-4 border-[#F17D0C]"
                : "text-[#FDF9F3]/60 hover:bg-[#F3B978]/10 hover:text-white border-l-4 border-transparent"
            }`}
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
          </button>

          <button
            onClick={() => onNavClick("pos")}
            className={`w-full flex items-center p-3 rounded-lg font-bold transition-colors whitespace-nowrap overflow-hidden ${
              activeTab === "pos"
                ? "bg-[#F3B978]/20 text-white shadow-md border-l-4 border-[#F17D0C]"
                : "text-[#FDF9F3]/60 hover:bg-[#F3B978]/10 hover:text-white border-l-4 border-transparent"
            }`}
          >
            <div className="flex items-center justify-center w-8 flex-shrink-0">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </div>
            <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
              Point of Sale
            </span>
          </button>

          <button
            onClick={() => onNavClick("orders")}
            className={`w-full flex items-center p-3 rounded-lg font-bold transition-colors whitespace-nowrap overflow-hidden ${
              activeTab === "orders"
                ? "bg-[#F3B978]/20 text-white shadow-md border-l-4 border-[#F17D0C]"
                : "text-[#FDF9F3]/60 hover:bg-[#F3B978]/10 hover:text-white border-l-4 border-transparent"
            }`}
          >
            <div className="flex items-center justify-center w-8 flex-shrink-0">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6h-2c0-2.8-2.2-5-5-5S7 3.2 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.7 0 3 1.3 3 3H9c0-1.7 1.3-3 3-3zm7 17H5V8h14v12zm-7-8c-1.7 0-3-1.3-3-3H7c0 2.8 2.2 5 5 5s5-2.2 5-5h-2c0 1.7-1.3 3-3 3z" />
              </svg>
            </div>
            <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
              Orders
            </span>
          </button>

          <button
            onClick={() => onNavClick("clients")}
            className={`w-full flex items-center p-3 rounded-lg font-bold transition-colors whitespace-nowrap overflow-hidden ${
              activeTab === "clients"
                ? "bg-[#F3B978]/20 text-white shadow-md border-l-4 border-[#F17D0C]"
                : "text-[#FDF9F3]/60 hover:bg-[#F3B978]/10 hover:text-white border-l-4 border-transparent"
            }`}
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
          </button>

          <div className="flex flex-col">
            <button
              onClick={() => {
                if (isAdmin) {
                  // Admins: first click expands the submenu (Reconciliation);
                  // the main view stays reachable via the item itself below.
                  setIsInventoryExpanded(!isInventoryExpanded);
                  // First tap on the collapsed tablet rail expands it so the submenu is visible
                  if (isTablet && !sidebarExpanded) setIsTabletSidebarOpen(true);
                }
                onNavClick("inventory");
              }}
              className={`w-full flex justify-between items-center p-3 rounded-lg font-bold transition-colors whitespace-nowrap overflow-hidden ${
                activeTab === "inventory" || activeTab === "inventory-closing-count" || activeTab === "inventory-reconciliation"
                  ? "bg-[#F3B978]/20 text-white shadow-md border-l-4 border-[#F17D0C]"
                  : "text-[#FDF9F3]/60 hover:bg-[#F3B978]/10 hover:text-white border-l-4 border-transparent"
              }`}
            >
              <div className="flex items-center">
                <div className="flex items-center justify-center w-8 flex-shrink-0">
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zM19 15.91v-6.7l-6 3.37v6.71l6-3.38z" />
                  </svg>
                </div>
                <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
                  Inventory
                </span>
              </div>
              {isAdmin && (
                <svg
                  onClick={(e) => {
                    // Chevron tap toggles the submenu without navigating
                    e.stopPropagation();
                    setIsInventoryExpanded(!isInventoryExpanded);
                  }}
                  className={`w-4 h-4 ml-2 transition-transform duration-200 ${
                    isInventoryExpanded ? "rotate-180" : ""
                  } ${sidebarLabelCls}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              )}
            </button>

            {isAdmin && isInventoryExpanded && (
              <div
                className={`mt-1 space-y-1 bg-[#4a2605] rounded-lg overflow-hidden transition-all shadow-inner ${
                  sidebarExpanded ? "md:block" : "md:hidden"
                } ${desktopRailExpanded ? "lg:block" : "lg:hidden"}`}
              >
                <button
                  onClick={() => onNavClick("inventory-reconciliation")}
                  className={`w-full text-left pl-14 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === "inventory-reconciliation"
                      ? "text-[#F17D0C] bg-[#3a1d04] border-l-2 border-[#F17D0C]"
                      : "text-[#FDF9F3]/70 hover:text-white hover:bg-[#3a1d04] border-l-2 border-transparent"
                  }`}
                >
                  Reconciliation
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavClick("recipes")}
            className={`w-full flex items-center p-3 rounded-lg font-bold transition-colors whitespace-nowrap overflow-hidden ${
              activeTab === "recipes"
                ? "bg-[#F3B978]/20 text-white shadow-md border-l-4 border-[#F17D0C]"
                : "text-[#FDF9F3]/60 hover:bg-[#F3B978]/10 hover:text-white border-l-4 border-transparent"
            }`}
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
          </button>

          <button
            onClick={() => onNavClick("production-runs")}
            className={`w-full flex items-center p-3 rounded-lg font-bold transition-colors whitespace-nowrap overflow-hidden ${
              activeTab === "production-runs"
                ? "bg-[#F3B978]/20 text-white shadow-md border-l-4 border-[#F17D0C]"
                : "text-[#FDF9F3]/60 hover:bg-[#F3B978]/10 hover:text-white border-l-4 border-transparent"
            }`}
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
          </button>

          <button
            onClick={() => onNavClick("calendar")}
            className={`w-full flex items-center p-3 rounded-lg font-bold transition-colors whitespace-nowrap overflow-hidden ${
              activeTab === "calendar"
                ? "bg-[#F3B978]/20 text-white shadow-md border-l-4 border-[#F17D0C]"
                : "text-[#FDF9F3]/60 hover:bg-[#F3B978]/10 hover:text-white border-l-4 border-transparent"
            }`}
          >
            <div className="flex items-center justify-center w-8 flex-shrink-0">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z" />
              </svg>
            </div>
            <span className={`ml-3 ${sidebarLabelCls} transition-opacity duration-300`}>
              Calendar
            </span>
          </button>

          <div className="flex flex-col">
            <button
              onClick={() => {
                setIsReportsExpanded(!isReportsExpanded);
                // First tap on the collapsed tablet rail expands it so the submenu is visible
                if (isTablet && !sidebarExpanded) setIsTabletSidebarOpen(true);
              }}
              className={`w-full flex justify-between items-center p-3 rounded-lg font-bold transition-colors whitespace-nowrap overflow-hidden ${
                activeTab.startsWith("reports")
                  ? "bg-[#F3B978]/20 text-white shadow-md border-l-4 border-[#F17D0C]"
                  : "text-[#FDF9F3]/60 hover:bg-[#F3B978]/10 hover:text-white border-l-4 border-transparent"
              }`}
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
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isReportsExpanded && (
              <div
                className={`mt-1 space-y-1 bg-[#4a2605] rounded-lg overflow-hidden transition-all shadow-inner ${
                  sidebarExpanded ? "md:block" : "md:hidden"
                } ${desktopRailExpanded ? "lg:block" : "lg:hidden"}`}
              >
                <button
                  onClick={() => onNavClick("reports-dashboard")}
                  className={`w-full text-left pl-14 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === "reports-dashboard"
                      ? "text-[#F17D0C] bg-[#3a1d04] border-l-2 border-[#F17D0C]"
                      : "text-[#FDF9F3]/70 hover:text-white hover:bg-[#3a1d04] border-l-2 border-transparent"
                  }`}
                >
                  Sales Dashboard
                </button>
                <button
                  onClick={() => onNavClick("reports-closing")}
                  className={`w-full text-left pl-14 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === "reports-closing"
                      ? "text-[#F17D0C] bg-[#3a1d04] border-l-2 border-[#F17D0C]"
                      : "text-[#FDF9F3]/70 hover:text-white hover:bg-[#3a1d04] border-l-2 border-transparent"
                  }`}
                >
                  End-of-Day Closing
                </button>
                <button
                  onClick={() => onNavClick("reports-inventory")}
                  className={`w-full text-left pl-14 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === "reports-inventory"
                      ? "text-[#F17D0C] bg-[#3a1d04] border-l-2 border-[#F17D0C]"
                      : "text-[#FDF9F3]/70 hover:text-white hover:bg-[#3a1d04] border-l-2 border-transparent"
                  }`}
                >
                  Closing Inventory
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Bottom Logout Area */}
        <div className="p-3 mb-4 mt-auto border-t border-[#F3B978]/20 pt-4">
          <div
            className={`px-3 mb-2 overflow-hidden whitespace-nowrap ${sidebarLabelCls} transition-opacity duration-300`}
          >
            <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
            <p className="text-xs text-[#FDF9F3]/50 truncate">{currentUser.email}</p>
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
      </aside>
    </>
  );
}

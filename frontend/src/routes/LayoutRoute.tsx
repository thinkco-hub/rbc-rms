import React, { useRef } from "react";
import { Outlet } from "react-router";
import MobileTopBar from "../components/layout/MobileTopBar";
import Sidebar from "../components/layout/Sidebar";
import { usePosSlice } from "../store/slices";
import { canUseSidebarRail, isPhoneViewport } from "../utils/responsive";
import { useShell } from "./shell";

/**
 * The layout route: it stays mounted while its outlet swaps, so it owns the
 * chrome and the ticket header the mobile bar reads. Feature overlays belong
 * to the route that opens them, not here.
 */
export default function LayoutRoute() {
  const {
    currentUser,
    logout,
    activeTab,
    isSidebarOpen,
    setIsSidebarOpen,
    isInventoryExpanded,
    setIsInventoryExpanded,
    isReportsExpanded,
    setIsReportsExpanded,
    windowWidth,
  } = useShell();
  const { cartQty, ticketCustomer, openCustomerPicker, clearTicket } = usePosSlice();

  // The drawer hands focus back to the control that opened it, which lives in
  // the top bar rather than in the sidebar.
  const navTriggerRef = useRef<HTMLButtonElement>(null);

  // Wide, mouse-driven viewports keep the pinned sidebar rail; phones and
  // tablets (including touch devices that report a desktop viewport) use the
  // hamburger drawer, so the top bar and the drawer share one test.
  const isDesktopRail = canUseSidebarRail(windowWidth);
  const isPosRoute = activeTab === "pos";

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[#562D07] focus:px-4 focus:py-2 focus:font-bold focus:text-white"
      >
        Skip to main content
      </a>

      {!isDesktopRail && (
        <MobileTopBar
          onOpenMobileNav={() => setIsSidebarOpen(true)}
          triggerRef={navTriggerRef}
          pos={
            isPosRoute && isPhoneViewport(windowWidth)
              ? {
                  ticketCount: cartQty,
                  customer: ticketCustomer,
                  onAddCustomer: openCustomerPicker,
                  onClearTicket: clearTicket,
                }
              : null
          }
        />
      )}

      <Sidebar
        currentUser={currentUser}
        onLogout={logout}
        windowWidth={windowWidth}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        triggerRef={navTriggerRef}
        isInventoryExpanded={isInventoryExpanded}
        setIsInventoryExpanded={setIsInventoryExpanded}
        isReportsExpanded={isReportsExpanded}
        setIsReportsExpanded={setIsReportsExpanded}
        onNavSelect={() => setIsSidebarOpen(false)}
      />

      <main
        id="main"
        tabIndex={-1}
        className={`flex-1 relative z-10 w-full flex flex-col ${
          isPosRoute ? "p-0 overflow-hidden bg-gray-100" : "p-4 md:p-8 overflow-y-auto"
        }`}
      >
        {/* The view titles are h2s; this is the one page heading, and it sits in
            the landmark the skip link targets. */}
        <h1 className="sr-only">Reid's Bakery HQ</h1>
        {/* Each route guards its own tab; see src/components/RequireAccess.tsx. */}
        <Outlet />
      </main>
    </>
  );
}

import { useEffect, useState } from "react";
import type { AppView, NavTabId } from "../types/domain";

/**
 * Owns application navigation: the active view (Reid's HQ vs Chams ledger),
 * the active tab, sidebar open/expanded state and the window width used by
 * the responsive sidebar and POS ticket.
 *
 * Detail-panel state (viewing an order / client / recipe) is owned by its
 * feature hook and is cleared by the app shell on navigation.
 */
export function useNavigation() {
  const [activeView, setActiveView] = useState<AppView>("reids");
  // Returning from the Google Calendar OAuth redirect (?calendar=...) lands
  // back on the calendar tab so the user sees the connection result.
  const [activeTab, setActiveTab] = useState<NavTabId>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("calendar")
      ? "calendar"
      : "dashboard"
  );
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isTabletSidebarOpen, setIsTabletSidebarOpen] = useState(false);
  const [isInventoryExpanded, setIsInventoryExpanded] = useState(false);
  const [isReportsExpanded, setIsReportsExpanded] = useState(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    activeView,
    setActiveView,
    activeTab,
    setActiveTab,
    isMobileOpen,
    setIsMobileOpen,
    isTabletSidebarOpen,
    setIsTabletSidebarOpen,
    isInventoryExpanded,
    setIsInventoryExpanded,
    isReportsExpanded,
    setIsReportsExpanded,
    windowWidth,
  };
}
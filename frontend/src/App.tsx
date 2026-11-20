import React from "react";
import { Route, Routes, useNavigate } from "react-router";
import LoginPage from "./components/auth/LoginPage";
import { AnnouncerProvider } from "./components/common/Announcer";
import UnknownRoute from "./components/common/UnknownRoute";
import { useAuth } from "./hooks/useAuth";
import { useNavigation } from "./hooks/useNavigation";
import { BakeryProvider } from "./store/BakeryProvider";
import AuditLogsRoute from "./routes/AuditLogsRoute";
import CalendarRoute from "./routes/CalendarRoute";
import ChamsRoute from "./routes/ChamsRoute";
import ClientDetailRoute from "./routes/ClientDetailRoute";
import ClientsRoute from "./routes/ClientsRoute";
import ClosingCountRoute from "./routes/ClosingCountRoute";
import DashboardRoute from "./routes/DashboardRoute";
import InventoryRoute from "./routes/InventoryRoute";
import LayoutRoute from "./routes/LayoutRoute";
import OrderDetailRoute from "./routes/OrderDetailRoute";
import OrdersRoute from "./routes/OrdersRoute";
import PosRoute from "./routes/PosRoute";
import ProductionRoute from "./routes/ProductionRoute";
import RecipeDetailRoute from "./routes/RecipeDetailRoute";
import RecipeNewRoute from "./routes/RecipeNewRoute";
import RecipesRoute from "./routes/RecipesRoute";
import ReconciliationRoute from "./routes/ReconciliationRoute";
import ReportsClosingRoute from "./routes/ReportsClosingRoute";
import ReportsInventoryRoute from "./routes/ReportsInventoryRoute";
import ReportsRoute from "./routes/ReportsRoute";
import RolesRoute from "./routes/RolesRoute";
import { ShellProvider } from "./routes/shell";
import type { ShellContextValue } from "./routes/shell";
import { CHAMS_PATH, PATH_BY_TAB } from "./routes";
import { DEFAULT_TAB, canAccessTab } from "./utils/permissions";
import { canUseSidebarRail } from "./utils/responsive";

/**
 * The shell: auth, the navigation state, and the route table. Feature state
 * lives in BakeryProvider, above the outlet, so swapping routes never reseeds a
 * hook; every route element reads its own slice.
 */
export default function BakeryCommandCenter() {
  const {
    users,
    currentUser,
    isRestoring,
    login,
    logout,
    getLockedUntil,
    updateUserRole,
    setUserActive,
    createUser,
  } = useAuth();
  const navigation = useNavigation();
  const navigate = useNavigate();

  // Wait for the session check so a signed-in reload never flashes the login page.
  if (isRestoring) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FDF9F3] text-gray-500">
        Loading…
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={login} getLockedUntil={getLockedUntil} />;
  }

  const shell: ShellContextValue = {
    currentUser,
    users,
    updateUserRole,
    setUserActive,
    createUser,
    // The tab survives logout because the URL does, so hand the address bar back
    // to the default tab instead of leaving the next sign-in on this one.
    logout: () => {
      void logout();
      navigate(PATH_BY_TAB[DEFAULT_TAB], { replace: true });
    },
    ...navigation,
    goToTab: (tab) => {
      if (!canAccessTab(currentUser.role, tab)) return;
      navigate(PATH_BY_TAB[tab]);
      navigation.setIsSidebarOpen(false);
    },
    openPath: (path, options) => navigate(path, options),
  };

  return (
    <AnnouncerProvider>
      <ShellProvider value={shell}>
        <BakeryProvider key={currentUser.id} currentUser={currentUser}>
          <div
            className={`flex flex-col ${
              canUseSidebarRail(navigation.windowWidth) ? "md:flex-row" : ""
            } h-screen bg-[#FDF9F3] font-sans text-[#121212] overflow-hidden relative`}
          >
            <Routes>
              <Route path="/" element={<LayoutRoute />}>
                <Route index element={<DashboardRoute />} />
                <Route path="pos" element={<PosRoute />} />
                <Route path="orders">
                  <Route index element={<OrdersRoute />} />
                  <Route path=":orderId" element={<OrderDetailRoute />} />
                </Route>
                <Route path="clients">
                  <Route index element={<ClientsRoute />} />
                  <Route path=":clientId" element={<ClientDetailRoute />} />
                </Route>
                <Route path="inventory">
                  <Route index element={<InventoryRoute />} />
                  <Route path="closing-count" element={<ClosingCountRoute />} />
                  <Route path="reconciliation" element={<ReconciliationRoute />} />
                </Route>
                <Route path="recipes">
                  <Route index element={<RecipesRoute />} />
                  <Route path="new" element={<RecipeNewRoute />} />
                  <Route path=":recipeId" element={<RecipeDetailRoute />} />
                </Route>
                <Route path="production-runs" element={<ProductionRoute />} />
                <Route path="calendar" element={<CalendarRoute />} />
                <Route path="reports">
                  <Route index element={<ReportsRoute />} />
                  <Route path="closing" element={<ReportsClosingRoute />} />
                  <Route path="inventory" element={<ReportsInventoryRoute />} />
                </Route>
                <Route path="audit-logs" element={<AuditLogsRoute />} />
                <Route path="roles" element={<RolesRoute />} />
                {/* Inside the layout so the sidebar survives a bad URL, and not
                    behind a tab guard: no tab is involved. */}
                <Route path="*" element={<UnknownRoute />} />
              </Route>
              <Route path={CHAMS_PATH} element={<ChamsRoute />} />
            </Routes>
          </div>
        </BakeryProvider>
      </ShellProvider>
    </AnnouncerProvider>
  );
}

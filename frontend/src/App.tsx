import React from "react";
import ChamsStockLedger from "./components/chams/ChamsStockLedger";
import LoginPage from "./components/auth/LoginPage";
import Sidebar from "./components/layout/Sidebar";
import MobileTopBar from "./components/layout/MobileTopBar";
import OrderConfirmationModal from "./components/pos/OrderConfirmationModal";
import ReceiptModal from "./components/pos/ReceiptModal";
import RestockModal from "./components/inventory/RestockModal";
import DashboardView from "./components/views/DashboardView";
import PosView from "./components/views/PosView";
import OrdersView from "./components/views/OrdersView";
import ClientsView from "./components/views/ClientsView";
import InventoryView from "./components/views/InventoryView";
import RecipesView from "./components/views/RecipesView";
import ProductionView from "./components/views/ProductionView";
import CalendarView from "./components/views/CalendarView";
import ReportsView from "./components/views/ReportsView";
import { initialPosProducts } from "./data/initialProducts";
import { useNavigation } from "./hooks/useNavigation";
import { useClients } from "./hooks/useClients";
import { useInventory } from "./hooks/useInventory";
import { useRecipes } from "./hooks/useRecipes";
import { useProduction } from "./hooks/useProduction";
import { useOrders } from "./hooks/useOrders";
import { useClosing } from "./hooks/useClosing";
import { usePos } from "./hooks/usePos";
import { useAuth } from "./hooks/useAuth";
import type { NavTabId, Order } from "./types/domain";

export default function BakeryCommandCenter() {
  // --- AUTH (src/hooks/useAuth.ts) ---
  const { currentUser, login, logout, getLockedUntil } = useAuth();

  // --- NAVIGATION (src/hooks/useNavigation.ts) ---
  const {
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
  } = useNavigation();

  // --- ROLE (TBD: real auth/session; placeholder so admin-only UI can render) ---
  const [isAdmin] = React.useState(true);

  // --- INVENTORY (src/hooks/useInventory.ts) ---
  const inventory = useInventory();
  const {
    menuInventory,
    ingredients,
    restockReminders,
    restockModal,
    setRestockModal,
    addIngredient,
    updateIngredient,
    addRestockReminder,
    toggleReminderDone,
    openRestock,
    handleRestockQuickAdd,
    closeRestockModal,
    submitRestock,
    restockItems,
    isRestockConfirmDisabled,
  } = inventory;

  // --- CLIENTS (src/hooks/useClients.ts) ---
  const {
    clients,
    viewingClient,
    setViewingClient,
    addClient,
    updateClient,
    clearViewingClient,
  } = useClients();
  // --- RECIPES / BOM (src/hooks/useRecipes.ts) ---
  const {
    recipes,
    pricingRules,
    viewingRecipe,
    setViewingRecipe,
    isCreatingRecipe,
    setIsCreatingRecipe,
    saveRecipe,
    cancelRecipeEdit,
    updatePricingRule,
  } = useRecipes();

  // --- PRODUCTION RUNS (src/hooks/useProduction.ts) ---
  const {
    productionRuns,
    scheduleProductionRun,
    completeProductionRun,
    deleteProductionRun,
  } = useProduction({
    recipes,
    deductRecipeLines: inventory.deductRecipeLines,
    addMenuStock: inventory.addMenuStock,
  });

  // --- ORDERS (src/hooks/useOrders.ts) ---
  const ordersState = useOrders({ deductOrderLines: inventory.deductOrderLines });
  const {
    orders,
    viewingOrder,
    setViewingOrder,
    createOrder,
    createOrderFromSale,
    recordOrderPayment,
    advanceOrderStatus,
    scheduleOrderDelivery,
    markOrderDelivered,
    clearViewingOrder,
  } = ordersState;

  // --- INVENTORY COUNTS, EXPENSES & END-OF-DAY CLOSING (src/hooks/useClosing.ts) ---
  const {
    inventoryCounts,
    expenses,
    dayClosings,
    submitClosingCount,
    resolveInventoryCount,
    applyAllPendingCounts,
    addExpense,
    deleteExpense,
    closeDay,
  } = useClosing({
    applyCountedQty: inventory.applyCountedQty,
    applyPendingCounts: inventory.applyPendingCounts,
  });

  // --- POS (src/hooks/usePos.ts) ---
  const pos = usePos({ posProducts: initialPosProducts, createOrderFromSale });
  const {
    posCategory,
    setPosCategory,
    filteredPosProducts,
    addToCart,
    cart,
    adjustCartQty,
    setCart,
    cartSubtotal,
    cartTax,
    cartTotal,
    confirmModal,
    setConfirmModal,
    updateConfirmField,
    closeConfirmModal,
    completeSale,
    sales,
    receipt,
    setReceipt,
    cartWidth,
    isResizing,
    startResizing,
    todayISO,
    isConfirmOrderDisabled,
  } = pos;

  // --- DERIVED CROSS-FEATURE VALUES (dashboard) ---
  const pendingOrdersCount = orders.filter(
    (o) => o.status === "Pending"
  ).length;
  const readyOrdersCount = orders.filter((o) => o.status === "Ready").length;
  const lowStockAlerts = [...menuInventory, ...ingredients].filter(
    (item) => item.qty < item.target
  );

  // --- NAVIGATION HANDLERS (compose navigation + feature-owned resets) ---
  const handleNavClick = (tab: NavTabId) => {
    setActiveTab(tab);
    clearViewingOrder();
    clearViewingClient();
    setViewingRecipe(null);
    setIsCreatingRecipe(false);
    setIsMobileOpen(false);
    setIsTabletSidebarOpen(false);
  };

  const handleViewOrder = (order: Order) => {
    setActiveTab("orders");
    setViewingOrder(order);
  };

  const goToProductionRuns = () => {
    setActiveTab("production-runs");
    clearViewingOrder();
  };

  if (!currentUser) {
    return <LoginPage onLogin={login} getLockedUntil={getLockedUntil} />;
  }

  return (
    <div
      className={`flex flex-col md:flex-row h-screen bg-[#FDF9F3] font-sans text-[#121212] overflow-hidden relative ${
        isResizing ? "cursor-col-resize select-none" : ""
      }`}
    >
      {activeView === "chams" ? (
        <ChamsStockLedger onSwitchView={() => setActiveView("reids")} />
      ) : (
        <>
      {/* RESTOCK MODAL (extracted to src/components/inventory/RestockModal.tsx) */}
      {restockModal.isOpen && (
        <RestockModal
          modal={restockModal}
          items={restockItems}
          onItemChange={(itemId) =>
            setRestockModal({ ...restockModal, selectedItemId: itemId })
          }
          onAmountChange={(amount) =>
            setRestockModal({ ...restockModal, amountToAdd: amount })
          }
          onQuickAdd={handleRestockQuickAdd}
          onClose={closeRestockModal}
          onConfirm={submitRestock}
          disabled={isRestockConfirmDisabled}
        />
      )}

      {/* ORDER CONFIRMATION MODAL (extracted to src/components/pos/OrderConfirmationModal.tsx) */}
      {confirmModal.isOpen && (
        <OrderConfirmationModal
          modal={confirmModal}
          cart={cart}
          cartTotal={cartTotal}
          todayISO={todayISO}
          onFieldChange={updateConfirmField}
          onClose={closeConfirmModal}
          onConfirm={completeSale}
          disabled={isConfirmOrderDisabled}
        />
      )}

      {/* RECEIPT MODAL (extracted to src/components/pos/ReceiptModal.tsx) */}
      {receipt && (
        <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
      )}

      {/* MOBILE TOP BAR (extracted to src/components/layout/MobileTopBar.tsx) */}
      <MobileTopBar
        onOpenMobileNav={() => setIsMobileOpen(true)}
        onSwitchView={() => setActiveView("chams")}
      />

      {/* SIDEBAR (extracted to src/components/layout/Sidebar.tsx) */}
      <Sidebar
        activeTab={activeTab}
        currentUser={currentUser}
        onLogout={logout}
        windowWidth={windowWidth}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        isTabletSidebarOpen={isTabletSidebarOpen}
        setIsTabletSidebarOpen={setIsTabletSidebarOpen}
        isInventoryExpanded={isInventoryExpanded}
        setIsInventoryExpanded={setIsInventoryExpanded}
        isReportsExpanded={isReportsExpanded}
        setIsReportsExpanded={setIsReportsExpanded}
        isAdmin={isAdmin}
        onNavClick={handleNavClick}
        onSwitchView={() => setActiveView("chams")}
      />

      {/* MAIN CONTENT AREA */}
      <main
        className={`flex-1 relative z-10 w-full flex flex-col ${
          activeTab === "pos"
            ? "p-0 overflow-hidden bg-gray-100"
            : "p-4 md:p-8 overflow-y-auto"
        }`}
      >
        {/* =========================================
            VIEW: DASHBOARD
        ========================================= */}
        {activeTab === "dashboard" && (
          <DashboardView
            orders={orders}
            clients={clients}
            lowStockAlerts={lowStockAlerts}
            pendingOrdersCount={pendingOrdersCount}
            readyOrdersCount={readyOrdersCount}
            onNavClick={handleNavClick}
            onViewOrder={handleViewOrder}
          />
        )}

        {/* =========================================
            VIEW: POS (Loyverse Style)
        ========================================= */}
        {activeTab === "pos" && (
          <PosView
            posCategory={posCategory}
            setPosCategory={setPosCategory}
            filteredPosProducts={filteredPosProducts}
            addToCart={addToCart}
            cart={cart}
            adjustCartQty={adjustCartQty}
            setCart={setCart}
            cartSubtotal={cartSubtotal}
            cartTax={cartTax}
            cartTotal={cartTotal}
            setConfirmModal={setConfirmModal}
            todayISO={todayISO}
            windowWidth={windowWidth}
            cartWidth={cartWidth}
            startResizing={startResizing}
          />
        )}

        {/* =========================================
            VIEW: ORDERS
        ========================================= */}
        {activeTab === "orders" && (
          <OrdersView
            orders={orders}
            clients={clients}
            menuInventory={menuInventory}
            viewingOrder={viewingOrder}
            onViewOrder={setViewingOrder}
            onCreate={createOrder}
            onAdvanceStatus={advanceOrderStatus}
            onScheduleDelivery={scheduleOrderDelivery}
            onMarkDelivered={markOrderDelivered}
            onRecordPayment={recordOrderPayment}
            onGoToProduction={goToProductionRuns}
          />
        )}

        {/* =========================================
            VIEW: CLIENTS
        ========================================= */}
        {activeTab === "clients" && (
          <ClientsView
            clients={clients}
            orders={orders}
            viewingClient={viewingClient}
            onView={setViewingClient}
            onAdd={addClient}
            onUpdate={updateClient}
            onViewOrder={(order) => {
              setActiveTab("orders");
              setViewingClient(null);
              setViewingOrder(order);
            }}
          />
        )}

        {/* =========================================
            VIEW: INVENTORY
        ========================================= */}
        {(
          activeTab === "inventory" ||
          activeTab === "inventory-closing-count" ||
          activeTab === "inventory-reconciliation"
        ) && (
          <InventoryView
            activeTab={activeTab}
            menuInventory={menuInventory}
            ingredients={ingredients}
            restockReminders={restockReminders}
            inventoryCounts={inventoryCounts}
            onNavClick={handleNavClick}
            onRestockToProduction={goToProductionRuns}
            onOpenRestock={openRestock}
            onAddIngredient={addIngredient}
            onUpdateIngredient={updateIngredient}
            onAddReminder={addRestockReminder}
            onToggleReminderDone={toggleReminderDone}
            onSubmitClosingCount={submitClosingCount}
            onResolveCount={resolveInventoryCount}
            onApplyAllCounts={applyAllPendingCounts}
          />
        )}

        {/* =========================================
            VIEW: RECIPES / BOM
        ========================================= */}
        {activeTab === "recipes" && (
          <RecipesView
            recipes={recipes}
            ingredients={ingredients}
            menuInventory={menuInventory}
            pricingRules={pricingRules}
            viewingRecipe={viewingRecipe}
            isCreatingRecipe={isCreatingRecipe}
            onViewRecipe={setViewingRecipe}
            onCreateRecipe={() => setIsCreatingRecipe(true)}
            onEditRule={updatePricingRule}
            onCancelEdit={cancelRecipeEdit}
            onSave={saveRecipe}
          />
        )}

        {/* =========================================
            VIEW: PRODUCTION RUNS
        ========================================= */}
        {activeTab === "production-runs" && (
          <ProductionView
            productionRuns={productionRuns}
            recipes={recipes}
            menuInventory={menuInventory}
            ingredients={ingredients}
            onSchedule={scheduleProductionRun}
            onComplete={completeProductionRun}
            onDelete={deleteProductionRun}
          />
        )}

        {/* =========================================
            VIEW: CALENDAR
        ========================================= */}
        {activeTab === "calendar" && <CalendarView />}

        {/* =========================================
            VIEWS: REPORTS
        ========================================= */}
        {(
          activeTab === "reports-dashboard" ||
          activeTab === "reports-closing" ||
          activeTab === "reports-inventory"
        ) && (
          <ReportsView
            activeTab={activeTab}
            sales={sales}
            onReprintSale={setReceipt}
            expenses={expenses}
            dayClosings={dayClosings}
            onAddExpense={addExpense}
            onDeleteExpense={deleteExpense}
            onCloseDay={closeDay}
            menuInventory={menuInventory}
            ingredients={ingredients}
            inventoryCounts={inventoryCounts}
          />
        )}
      </main>
        </>
      )}
    </div>
  );
}

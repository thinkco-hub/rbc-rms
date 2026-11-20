import React from "react";
import InventoryView from "../components/views/InventoryView";
import RestockModal from "../components/inventory/RestockModal";
import { useAnnounce } from "../components/common/Announcer";
import { RequireTab } from "../components/RequireAccess";
import {
  useCanViewIngredients,
  useCatalogueSlice,
  useVisibleIngredients,
} from "../store/slices";
import { useShell } from "./shell";

export default function InventoryRoute() {
  const { currentUser, goToTab } = useShell();
  const {
    stockItems,
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
  } = useCatalogueSlice();
  const canViewIngredients = useCanViewIngredients();
  const visibleIngredients = useVisibleIngredients();
  const announce = useAnnounce();

  const confirmRestock = () => {
    const item = restockItems.find((entry) => entry.id === restockModal.selectedItemId);
    submitRestock();
    if (item) announce(`Restocked ${item.name} by ${restockModal.amountToAdd}.`);
  };

  return (
    <RequireTab role={currentUser.role} tab="inventory">
      <InventoryView
        menuInventory={stockItems}
        ingredients={visibleIngredients}
        restockReminders={restockReminders}
        canViewIngredients={canViewIngredients}
        onNavClick={goToTab}
        onOpenRestock={openRestock}
        onScheduleRun={() => goToTab("production-runs")}
        onAddIngredient={addIngredient}
        onUpdateIngredient={updateIngredient}
        onAddReminder={addRestockReminder}
        onToggleReminderDone={toggleReminderDone}
      />

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
          onConfirm={confirmRestock}
          disabled={isRestockConfirmDisabled}
        />
      )}
    </RequireTab>
  );
}

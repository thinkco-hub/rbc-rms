import React from "react";
import OrderConfirmationModal from "../components/pos/OrderConfirmationModal";
import PosCustomerPicker from "../components/pos/PosCustomerPicker";
import ReceiptModal from "../components/pos/ReceiptModal";
import TicketCustomerInput from "../components/pos/TicketCustomerInput";
import PosView from "../components/views/PosView";
import { RequireTab } from "../components/RequireAccess";
import { useClientsSlice, usePosSlice } from "../store/slices";
import { canAccessTab } from "../utils/permissions";
import { useShell } from "./shell";

export default function PosRoute() {
  const { currentUser } = useShell();
  const {
    posCategory,
    setPosCategory,
    posSearch,
    setPosSearch,
    filteredPosProducts,
    addToCart,
    cart,
    adjustCartQty,
    isTicketViewOpen,
    openTicketView,
    closeTicketView,
    clearTicket,
    cartSubtotal,
    cartTax,
    cartTotal,
    ticketCustomer,
    clearTicketCustomer,
    openCustomerPicker,
    openConfirmModal,
    confirmModal,
    updateConfirmField,
    setSaleType,
    closeConfirmModal,
    completeSale,
    isSubmitting,
    checkoutError,
    isConfirmOrderDisabled,
    todayISO,
    isCustomerPickerOpen,
    closeCustomerPicker,
    attachTicketCustomer,
    receipt,
    setReceipt,
    customerDraft,
    updateCustomerDraft,
  } = usePosSlice();
  const { clients, addClient } = useClientsSlice();

  // The roster overlay is the one the top bar can open too; RequireAccess
  // cannot guard it, so the same Clients grant decides between the roster and
  // the typed form.
  const canViewClients = canAccessTab(currentUser.role, "clients");

  return (
    <RequireTab role={currentUser.role} tab="pos">
      <PosView
        posCategory={posCategory}
        setPosCategory={setPosCategory}
        posSearch={posSearch}
        setPosSearch={setPosSearch}
        filteredPosProducts={filteredPosProducts}
        addToCart={addToCart}
        cart={cart}
        adjustCartQty={adjustCartQty}
        isTicketViewOpen={isTicketViewOpen}
        openTicketView={openTicketView}
        closeTicketView={closeTicketView}
        clearTicket={clearTicket}
        cartSubtotal={cartSubtotal}
        cartTax={cartTax}
        cartTotal={cartTotal}
        customer={ticketCustomer}
        onRemoveCustomer={clearTicketCustomer}
        onAddCustomer={openCustomerPicker}
        openConfirmModal={openConfirmModal}
      />

      {confirmModal.isOpen && (
        <OrderConfirmationModal
          modal={confirmModal}
          cart={cart}
          cartTotal={cartTotal}
          todayISO={todayISO}
          onFieldChange={updateConfirmField}
          onSaleTypeChange={setSaleType}
          onClose={closeConfirmModal}
          onConfirm={() => void completeSale()}
          disabled={isConfirmOrderDisabled}
          error={checkoutError}
          isSubmitting={isSubmitting}
        />
      )}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}

      {isCustomerPickerOpen &&
        (canViewClients ? (
          <PosCustomerPicker
            clients={clients}
            attached={ticketCustomer}
            onClose={closeCustomerPicker}
            onAttach={attachTicketCustomer}
            onCreateClient={addClient}
          />
        ) : (
          <TicketCustomerInput
            name={customerDraft.name}
            contact={customerDraft.contact}
            onNameChange={(value) => updateCustomerDraft("name", value)}
            onContactChange={(value) => updateCustomerDraft("contact", value)}
            onClose={closeCustomerPicker}
            onAttach={attachTicketCustomer}
          />
        ))}
    </RequireTab>
  );
}

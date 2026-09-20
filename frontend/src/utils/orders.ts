import type {
  MenuItemStock,
  Order,
  OrderShortfall,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "../types/domain";

export function computeOrderTotal(order: Order): number {
  return order.items.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
}

export function computeOrderItemUnits(order: Order): number {
  return order.items.reduce((sum, line) => sum + line.qty, 0);
}

export function getOrderShortfalls(
  order: Order,
  menuInventory: MenuItemStock[]
): OrderShortfall[] {
  return order.items
    .map((line) => {
      const menuItem = menuInventory.find((m) => m.id === line.menuItemId);
      if (!menuItem) return null;
      return {
        menuItemId: line.menuItemId,
        name: menuItem.name,
        requestedQty: line.qty,
        available: menuItem.qty,
        shortfall: Math.max(0, line.qty - menuItem.qty),
      };
    })
    // Type predicate (not a plain truthy check) is required so TS can
    // narrow this to OrderShortfall[] without an `as` cast. Behaviorally
    // identical: the preceding map only ever returns null or a
    // shortfall object, never any other falsy value.
    .filter((line): line is OrderShortfall => line !== null && line.shortfall > 0);
}

export function hasShortfall(order: Order, menuInventory: MenuItemStock[]): boolean {
  return getOrderShortfalls(order, menuInventory).length > 0;
}

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "Pending",
  "In Production",
  "Ready",
  "Delivered",
];

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const idx = ORDER_STATUSES.indexOf(status);
  return idx >= 0 && idx < ORDER_STATUSES.length - 1 ? ORDER_STATUSES[idx + 1] : null;
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "Cash",
  "GCash",
  "Bank Transfer",
  "Card",
];

export function computeAmountDue(order: Order): number {
  return Math.max(0, computeOrderTotal(order) - (order.amountPaid || 0));
}

export function getPaymentStatus(order: Order): PaymentStatus {
  const amountPaid = order.amountPaid || 0;
  if (amountPaid <= 0) return "Unpaid";
  return amountPaid >= computeOrderTotal(order) ? "Paid" : "Partial";
}
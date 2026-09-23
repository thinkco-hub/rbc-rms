import type {
  IngredientStock,
  InventoryCount,
  RestockReminder,
} from "../types/domain";

// Seed raw ingredient stock (FR-1.1)
export const initialIngredients: IngredientStock[] = [
  {
    id: "ING-01",
    name: "All-Purpose Flour",
    qty: 50,
    target: 100,
    unit: "kg",
    type: "Ingredient",
    supplier: "Manila Flour Mills",
    unitCost: 55,
  },
  {
    id: "ING-02",
    name: "Granulated Sugar",
    qty: 25,
    target: 40,
    unit: "kg",
    type: "Ingredient",
    supplier: "Victorias Sugar Co.",
    unitCost: 68,
  },
  {
    id: "ING-03",
    name: "Unsalted Butter",
    qty: 15,
    target: 30,
    unit: "kg",
    type: "Ingredient",
    supplier: "Dairy Fresh PH",
    unitCost: 320,
  },
  {
    id: "ING-04",
    name: "Whole Milk",
    qty: 20,
    target: 40,
    unit: "Liters",
    type: "Ingredient",
    supplier: "Dairy Fresh PH",
    unitCost: 95,
  },
  {
    id: "ING-05",
    name: "Active Dry Yeast",
    qty: 2,
    target: 5,
    unit: "kg",
    type: "Ingredient",
    supplier: "Baker's Supply Depot",
    unitCost: 410,
  },
];

// Seed restock reminders (FR-1.2)
export const initialRestockReminders: RestockReminder[] = [
  {
    id: "RR-001",
    ingredientId: "ING-01",
    note: "Order extra ahead of the weekend rush",
    dueDate: "2026-08-25",
    done: false,
  },
  {
    id: "RR-002",
    ingredientId: "ING-05",
    note: "Yeast running low, call supplier",
    dueDate: "2026-08-23",
    done: false,
  },
];

// Seed inventory reconciliation count (FR-4.4)
export const initialInventoryCounts: InventoryCount[] = [
  {
    id: "IC-001",
    itemId: "L-044",
    itemType: "menu",
    date: "2026-08-20",
    systemQty: 20,
    countedQty: 15,
    discrepancy: -5,
    status: "pending",
  },
];
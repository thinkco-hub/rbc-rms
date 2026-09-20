import type { Recipe } from "../types/domain";

// Seed recipes / bills of materials (FR-2.x) — extracted from App.jsx (§7 Phase 4)
export const initialRecipes: Recipe[] = [
  {
    id: "REC-01",
    menuItemId: "B-101",
    name: "Butter Croissants",
    yieldQty: 30,
    yieldUnit: "pcs",
    ingredients: [
      { ingredientId: "ING-01", qty: 4, unit: "kg" },
      { ingredientId: "ING-03", qty: 2, unit: "kg" },
      { ingredientId: "ING-04", qty: 1, unit: "Liters" },
      { ingredientId: "ING-05", qty: 0.1, unit: "kg" },
    ],
  },
  {
    id: "REC-02",
    menuItemId: "B-102",
    name: "Almond Croissants",
    yieldQty: 20,
    yieldUnit: "pcs",
    ingredients: [
      { ingredientId: "ING-01", qty: 3, unit: "kg" },
      { ingredientId: "ING-03", qty: 1.5, unit: "kg" },
      { ingredientId: "ING-02", qty: 1, unit: "kg" },
    ],
  },
];
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { initialIngredients } from "../data/initialInventory";
import { initialUsers } from "../data/initialUsers";
import { seedFakeApi, signInFake } from "../test/fake-api";
import { computeClosingInventory } from "../utils/closingInventory";
import { useCatalogue } from "./useCatalogue";
import { useProduction } from "./useProduction";
import type { CatalogueItem, ProductionRun, RecipeInput } from "../types/domain";

const admin = initialUsers.find((u) => u.email === "admin@rbc.test") ?? initialUsers[0];

const CROISSANT: CatalogueItem = {
  id: "B-101",
  name: "Butter Croissants",
  type: "Menu Item",
  category: "Pastries",
  price: 120,
  qty: 10,
  target: 20,
  shelfLife: "24 Hours",
  color: "bg-amber-400",
  trackedStock: true,
  yieldQty: 30,
  yieldUnit: "pcs",
  ingredients: [{ ingredientId: "ING-01", qty: 4, unit: "kg" }],
};

const AMERICANO: CatalogueItem = {
  id: "p10",
  name: "Americano",
  type: "Menu Item",
  category: "Drinks",
  price: 110,
  qty: 0,
  target: 0,
  shelfLife: "",
  color: "bg-gray-800",
  trackedStock: false,
  ingredients: [],
};

const COFFEE_RUN: ProductionRun = {
  id: "PR-001",
  recipeId: "B-101",
  plannedQty: 30,
  plannedDate: "2026-11-01",
  notes: "",
  status: "scheduled",
  completedDate: null,
};

const SEED = [CROISSANT, AMERICANO];

function mountCatalogue(catalogue: CatalogueItem[] = SEED) {
  // The fake API holds the same records, so a save lands on a matching row.
  seedFakeApi({ catalogue, ingredients: initialIngredients });
  signInFake(admin.email);
  return renderHook(() =>
    useCatalogue({ currentUser: admin, catalogue, ingredients: initialIngredients })
  );
}

/** Only the fields the editor writes; the POS colour and stock flag stay with the record. */
function recipeInput(item: CatalogueItem, patch: Partial<RecipeInput> = {}): RecipeInput {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    category: item.category,
    price: item.price,
    qty: item.qty,
    target: item.target,
    shelfLife: item.shelfLife,
    yieldQty: item.yieldQty,
    yieldUnit: item.yieldUnit,
    ingredients: item.ingredients,
    ...patch,
  };
}

describe("catalogue projections", () => {
  it("projects every item into a POS card and only tracked items into stock", () => {
    const { result } = mountCatalogue();

    expect(result.current.posProducts).toEqual([
      {
        id: "B-101",
        name: "Butter Croissants",
        price: 120,
        category: "Pastries",
        color: "bg-amber-400",
      },
      {
        id: "p10",
        name: "Americano",
        price: 110,
        category: "Drinks",
        color: "bg-gray-800",
      },
    ]);
    // An untracked drink stays out of the finished-goods projection.
    expect(result.current.stockItems.map((item) => item.id)).toEqual(["B-101"]);
  });

  it("reflects a recipe edit in the POS projection and keeps the swatch", async () => {
    const { result } = mountCatalogue();

    await act(async () => {
      await result.current.saveRecipe(
        recipeInput(CROISSANT, { name: "Butter Croissants Deluxe", price: 135 })
      );
    });

    expect(result.current.posProducts.find((p) => p.id === "B-101")).toMatchObject({
      name: "Butter Croissants Deluxe",
      price: 135,
      color: "bg-amber-400",
    });
    expect(result.current.stockItems[0]).toMatchObject({
      name: "Butter Croissants Deluxe",
      price: 135,
      trackedStock: true,
    });
  });
});

describe("catalogue stock movements", () => {
  it("deducts a tracked item's stock on the record the POS sells", () => {
    const { result } = mountCatalogue();

    act(() =>
      result.current.deductOrderLines([
        { menuItemId: "B-101", qty: 3, unitPrice: 120 },
      ])
    );

    expect(result.current.stockItems.find((item) => item.id === "B-101")?.qty).toBe(7);
    expect(result.current.catalogue.find((item) => item.id === "B-101")?.qty).toBe(7);
  });

  it("leaves an untracked item's quantity alone for every movement", () => {
    const { result } = mountCatalogue();

    act(() => {
      result.current.deductOrderLines([{ menuItemId: "p10", qty: 2, unitPrice: 110 }]);
      result.current.addMenuStock("p10", 5);
      result.current.applyCountedQty("menu", "p10", 4);
    });

    expect(result.current.catalogue.find((item) => item.id === "p10")?.qty).toBe(0);
  });

  it("adds a completed production run to the same catalogue quantity", () => {
    const { result } = renderHook(() => {
      const catalogue = useCatalogue({
        currentUser: admin,
        catalogue: [CROISSANT],
        ingredients: initialIngredients,
      });
      const production = useProduction({
        recipes: catalogue.stockItems,
        deductRecipeLines: catalogue.deductRecipeLines,
        addMenuStock: catalogue.addMenuStock,
        currentUser: admin,
        productionRuns: [COFFEE_RUN],
      });
      return { catalogue, production };
    });

    act(() => result.current.production.completeProductionRun("PR-001"));

    expect(result.current.catalogue.catalogue.find((item) => item.id === "B-101")?.qty).toBe(40);
    // The run's BOM line left the raw-material stock it names.
    expect(result.current.catalogue.ingredients.find((item) => item.id === "ING-01")?.qty).toBe(46);
  });

  it("reads the renamed record in closing inventory", async () => {
    const { result } = mountCatalogue();

    await act(async () => {
      await result.current.saveRecipe(recipeInput(CROISSANT, { name: "Butter Croissants Deluxe" }));
    });

    const report = computeClosingInventory(
      { start: "2026-11-01", end: "2026-11-30" },
      result.current.stockItems,
      [],
      []
    );

    expect(report.menuRows.map((row) => row.name)).toEqual(["Butter Croissants Deluxe"]);
  });
});

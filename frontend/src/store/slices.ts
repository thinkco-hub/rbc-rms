import { useBakeryStore } from "./BakeryProvider";
import { canAccessIngredients, canViewRecipeCosts } from "../utils/permissions";
import type { BakeryStore } from "./BakeryProvider";
import type { IngredientStock } from "../types/domain";

export type CatalogueSlice = BakeryStore["catalogue"];
export type ClientsSlice = BakeryStore["clients"];
export type ProductionSlice = BakeryStore["production"];
export type OrdersSlice = BakeryStore["orders"];
export type ClosingSlice = BakeryStore["closing"];
export type PosSlice = BakeryStore["pos"];

export const useCatalogueSlice = (): CatalogueSlice => useBakeryStore().catalogue;
export const useClientsSlice = (): ClientsSlice => useBakeryStore().clients;
export const useProductionSlice = (): ProductionSlice => useBakeryStore().production;
export const useOrdersSlice = (): OrdersSlice => useBakeryStore().orders;
export const useClosingSlice = (): ClosingSlice => useBakeryStore().closing;
export const usePosSlice = (): PosSlice => useBakeryStore().pos;

export const useCanViewIngredients = (): boolean =>
  canAccessIngredients(useBakeryStore().currentUser.role);

export const useCanViewIngredientCosts = (): boolean =>
  canViewRecipeCosts(useBakeryStore().currentUser.role);

/**
 * Raw-material stock reduced to the one projection the screens may read. Its
 * default is no rows: a screen added later cannot disclose unit costs by
 * forgetting to ask. The full array stays with the admin-tier Reconciliation
 * screen and with the two tools that need an ingredient's identity to do their
 * job — production runs and the recipe editor — where the money derived from
 * unit cost is suppressed by useCanViewIngredientCosts instead.
 */
export function useVisibleIngredients(): IngredientStock[] {
  const ingredients = useCatalogueSlice().ingredients;
  return useCanViewIngredients() ? ingredients : [];
}

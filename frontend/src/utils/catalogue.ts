import type { CatalogueItem, PosProduct } from "../types/domain";

/** Swatch for a recipe created from the editor, which has no POS colour of its own. */
export const DEFAULT_POS_COLOR = "bg-amber-400";

/** POS card projection: identity, price, category and swatch only. */
export function toPosProducts(catalogue: CatalogueItem[]): PosProduct[] {
  return catalogue.map(({ id, name, price, category, color }) => ({
    id,
    name,
    price,
    category,
    color,
  }));
}

/** Finished-goods projection: stock screens never see an untracked item. */
export function trackedItems(catalogue: CatalogueItem[]): CatalogueItem[] {
  return catalogue.filter((item) => item.trackedStock);
}

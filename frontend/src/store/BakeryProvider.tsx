import React, { createContext, useContext } from "react";
import { useCatalogue } from "../hooks/useCatalogue";
import { useClients } from "../hooks/useClients";
import { useClosing } from "../hooks/useClosing";
import { useOrders } from "../hooks/useOrders";
import { usePos } from "../hooks/usePos";
import { useProduction } from "../hooks/useProduction";
import type {
  CatalogueItem,
  Client,
  IngredientStock,
  InventoryCount,
  Order,
  ProductionRun,
  RestockReminder,
  Sale,
  User,
} from "../types/domain";

/**
 * The collections a test fixture may replace. The app passes no seed, so every
 * hook starts from src/data exactly as it did when the shell called it.
 */
export interface BakerySeed {
  catalogue?: CatalogueItem[];
  ingredients?: IngredientStock[];
  restockReminders?: RestockReminder[];
  clients?: Client[];
  productionRuns?: ProductionRun[];
  orders?: Order[];
  inventoryCounts?: InventoryCount[];
  sales?: Sale[];
}

export interface BakeryStore {
  currentUser: User;
  catalogue: ReturnType<typeof useCatalogue>;
  clients: ReturnType<typeof useClients>;
  production: ReturnType<typeof useProduction>;
  orders: ReturnType<typeof useOrders>;
  closing: ReturnType<typeof useClosing>;
  pos: ReturnType<typeof usePos>;
}

const BakeryContext = createContext<BakeryStore | null>(null);

interface BakeryProviderProps {
  currentUser: User;
  seed?: BakerySeed;
  children: React.ReactNode;
}

/**
 * Calls every feature hook once and exposes the slices. The catalogue, clients,
 * orders and POS hooks load from the Django API; production runs and closing
 * counts are still local to the session until their screens are wired up. It lives above the
 * router outlet, so swapping routes changes what reads the state, never the
 * state itself. The hooks are ordered by dependency: the catalogue feeds stock
 * movements to orders, production and closing, and the POS reads its products
 * from the same records.
 */
export function BakeryProvider({ currentUser, seed, children }: BakeryProviderProps) {
  const catalogue = useCatalogue({
    currentUser,
    catalogue: seed?.catalogue,
    ingredients: seed?.ingredients,
    restockReminders: seed?.restockReminders,
  });
  const clients = useClients({ currentUser, clients: seed?.clients });
  const production = useProduction({
    recipes: catalogue.stockItems,
    deductRecipeLines: catalogue.deductRecipeLines,
    addMenuStock: catalogue.addMenuStock,
    currentUser,
    productionRuns: seed?.productionRuns,
  });
  const orders = useOrders({
    onStockMoved: catalogue.refreshStock,
    currentUser,
    orders: seed?.orders,
  });
  const closing = useClosing({
    applyCountedQty: catalogue.applyCountedQty,
    applyPendingCounts: catalogue.applyPendingCounts,
    currentUser,
    inventoryCounts: seed?.inventoryCounts,
  });
  const pos = usePos({
    posProducts: catalogue.posProducts,
    // The server deducted walk-in stock and opened any pre-order; reload both.
    onSaleCommitted: () => Promise.allSettled([catalogue.refreshStock(), orders.refreshOrders()]),
    currentUser,
    sales: seed?.sales,
  });

  return (
    <BakeryContext.Provider
      value={{ currentUser, catalogue, clients, production, orders, closing, pos }}
    >
      {children}
    </BakeryContext.Provider>
  );
}

/** The whole store, for a module that legitimately spans several features. */
export function useBakeryStore(): BakeryStore {
  const store = useContext(BakeryContext);
  if (!store) throw new Error("useBakeryStore must be used inside BakeryProvider");
  return store;
}

# PRD: App Extraction and JSX-to-TSX Migration

## 1. Overview

Refactor the bakery command center so that `src/App.jsx` becomes a small application orchestrator instead of owning the full UI, seed data, state management, business actions, navigation, and modal markup. Migrate the application to TypeScript incrementally, ending with `App.tsx` and typed extracted components, hooks, data, and utilities.

The refactor must preserve the existing user-visible behavior and current navigation model.

## 2. Current State

- `src/App.jsx` is approximately 2,565 lines.
- The component currently owns:
  - Application navigation and responsive sidebar behavior.
  - POS products, cart state, checkout, sales, receipts, and pre-orders.
  - Clients and client updates.
  - Orders and order status/payment/delivery actions.
  - Menu inventory, ingredients, restock reminders, and reconciliation.
  - Recipes, pricing rules, and production runs.
  - Expenses and end-of-day closing.
  - Large modal implementations and most page-level conditional rendering.
- `src/index.tsx` already uses TypeScript and renders `App`.
- `tsconfig.json` uses strict mode, `jsx: "react-jsx"`, and temporarily permits JavaScript through `allowJs: true`.
- The application uses Vite, React 18, Tailwind CSS, and local state rather than a routing library.
- There are currently no repository documentation files or identified automated tests.

## 3. Problem Statement

`App.jsx` is understandable in sections, but its size and mixed responsibilities make changes risky. A developer changing the sidebar must navigate through business logic and modal code. State transitions are difficult to test independently, and JavaScript values are not checked by TypeScript. The current `allowJs` configuration enables gradual migration but should not become the permanent type-safety boundary.

## 4. Goals

1. Reduce `App.jsx` to a clear orchestration component.
2. Give each major feature a focused UI, state, and data boundary.
3. Preserve current behavior, visual styling, navigation IDs, and user workflows.
4. Migrate the application from `.jsx`/`.js` to `.tsx`/`.ts` incrementally.
5. Establish shared domain types for orders, clients, inventory, recipes, production runs, sales, and reports.
6. Make the codebase buildable and type-checkable after every migration phase.
7. Enable focused testing of business actions without rendering the entire application.

## 5. Non-Goals

- Replacing the current visual design system.
- Introducing a backend, database, authentication, or remote API.
- Replacing the `activeTab` navigation model with a routing library.
- Rewriting business rules that are unrelated to the extraction.
- Broad UI redesign or unrelated bug fixes.
- Converting every file in one large, unreviewable change.

## 6. Target Architecture

### Application shell

`App.tsx` should coordinate application-level state and compose the shell:

- `AppLayout.tsx`
- `Sidebar.tsx`
- `MobileTopBar.tsx`
- `AppContent.tsx`
- Feature views and modals

The shell should receive focused state and callbacks rather than implement feature details.

### Feature components

Extract the following boundaries:

- `src/components/layout/Sidebar.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/pos/PosView.tsx`
- `src/components/pos/OrderConfirmationModal.tsx`
- `src/components/pos/ReceiptModal.tsx`
- `src/components/inventory/RestockModal.tsx`
- `src/components/views/DashboardView.tsx`
- `src/components/views/OrdersView.tsx`
- `src/components/views/ClientsView.tsx`
- `src/components/views/InventoryView.tsx`
- `src/components/views/RecipesView.tsx`
- `src/components/views/ProductionView.tsx`
- `src/components/views/ReportsView.tsx`

Existing feature components should be reused where they already provide an appropriate boundary.

### State hooks

Create focused hooks as needed:

- `src/hooks/useNavigation.ts`
- `src/hooks/usePos.ts`
- `src/hooks/useOrders.ts`
- `src/hooks/useClients.ts`
- `src/hooks/useInventory.ts`
- `src/hooks/useRecipes.ts`
- `src/hooks/useProduction.ts`
- `src/hooks/useClosing.ts`

A hook should own the state and actions for one feature. It should not contain unrelated JSX.

### Data and domain types

Create typed initial data and shared models:

- `src/data/initialClients.ts`
- `src/data/initialOrders.ts`
- `src/data/initialInventory.ts`
- `src/data/initialRecipes.ts`
- `src/data/initialProductionRuns.ts`
- `src/types/domain.ts`

Types should cover IDs, status values, item shapes, dates, quantities, payment methods, and modal form data. Prefer string unions for finite values such as order status, inventory item type, and payment method.

### Utilities

Convert utility modules from `.js` to `.ts` after their input and output contracts are defined:

- `src/utils/production.ts`
- `src/utils/counts.ts`
- `src/utils/orders.ts`
- Other utilities as their owning feature is migrated.

## 7. Migration Strategy

### Phase 0: Baseline

- Record the current `App.jsx` behavior and supported navigation tabs.
- Run `npm run build` before changes.
- Confirm the current app starts and the following workflows work:
  - Sidebar navigation and responsive open/close behavior.
  - POS cart quantity changes and checkout.
  - Pre-order creation.
  - Restocking.
  - Order payment, status, delivery, and inventory deduction.
  - Production completion and inventory updates.
  - Closing count reconciliation.

### Phase 1: Extract the sidebar

Move the sidebar JSX and responsive behavior into `Sidebar.jsx` or `Sidebar.tsx` once its prop contract is known. Preserve:

- `activeTab` values.
- `handleNavClick` behavior.
- Mobile overlay behavior.
- Tablet collapsed/expanded rail behavior.
- Inventory and Reports submenu behavior.
- Chams branch switch.

This is the first extraction because the sidebar has a clear boundary and is a high-value readability improvement.

### Phase 2: Extract modal UI

Move the restock modal, order confirmation modal, and receipt modal into focused components. Keep calculation and state ownership in the POS/inventory hooks where practical. Modal components should receive explicit props for values, callbacks, and disabled states.

### Phase 3: Extract feature views

Move large `activeTab` conditional blocks into feature views. Keep the existing `activeTab` string contract during this phase. Avoid introducing a new router solely for this refactor.

### Phase 4: Extract state and seed data

Move initial arrays and feature actions into typed data modules and hooks. Replace duplicated state updates with feature-owned actions. Preserve the current optimistic local-state behavior.

### Phase 5: Convert utilities and components to TypeScript

Rename files from `.js`/`.jsx` to `.ts`/`.tsx` in focused groups. Add shared types first, then type props, state, event handlers, and callback arguments. Use discriminated unions or string unions for finite domain states.

### Phase 6: Convert the app shell

Rename `App.jsx` to `App.tsx` only after the extracted components, hooks, data, and utilities have typed contracts. Update imports if required and remove any remaining implicit `any` values.

### Phase 7: Tighten TypeScript settings

After all source files are migrated and the build is clean, remove `allowJs: true` from `tsconfig.json`. Confirm that no JavaScript source files remain under `src/`, unless an explicit exception is documented.

## 8. Functional Requirements

- FR-1: Existing navigation destinations continue to open using the same tab identifiers.
- FR-2: Sidebar behavior remains correct on mobile, tablet, and desktop widths.
- FR-3: Inventory and Reports submenus continue to expand and select child views.
- FR-4: POS cart add, increment, decrement, remove, tax, and total behavior remains unchanged.
- FR-5: Checkout continues to create sales and future-date pre-orders correctly.
- FR-6: Receipt display, reprint, close, and print behavior remains available.
- FR-7: Orders continue to support creation, payment recording, status changes, scheduling, and delivery.
- FR-8: Delivered orders and completed production runs continue to update inventory correctly.
- FR-9: Restock and reconciliation workflows continue to update the correct inventory collection.
- FR-10: Recipes, production runs, reports, expenses, and closing workflows remain available.
- FR-11: All migrated components expose typed props and do not rely on implicit `any` values.
- FR-12: The project builds successfully with JavaScript support disabled after migration.

## 9. Quality Requirements

- No unrelated visual or business-rule changes.
- Each extraction should be a small, reviewable change.
- The application must build after every phase.
- TypeScript diagnostics must be resolved before disabling `allowJs`.
- Business actions should be testable independently of large JSX trees.
- Shared types should be defined once and imported by consumers.
- No component should become a replacement monolith for `App.jsx`.

## 10. Acceptance Criteria

The work is complete when:

1. `App.tsx` exists and is substantially limited to app composition and high-level coordination.
2. Sidebar JSX and sidebar-specific responsive logic are outside `App.tsx`.
3. POS, restock, order confirmation, and receipt modal JSX are outside `App.tsx`.
4. Major feature views are separated from the app shell.
5. Seed data is outside the app component.
6. Feature state and actions are grouped into focused typed hooks or equivalent modules.
7. Domain models are represented by shared TypeScript types.
8. `npm run build` succeeds.
9. TypeScript diagnostics report no errors in `src/`.
10. `tsconfig.json` no longer requires `allowJs: true`.
11. Manual verification confirms the workflows listed in Phase 0.
12. The diff contains no unrelated redesign or behavior changes.

## 11. Validation Plan

Run after each extraction:

```text
npm run build
```

At the end, additionally verify:

- No `.jsx` or `.js` application source files remain under `src/`, unless documented.
- No implicit `any` diagnostics are present.
- Responsive sidebar behavior at mobile, tablet, and desktop widths.
- POS checkout and receipt flow.
- Order delivery and inventory deduction.
- Production completion and ingredient deduction.
- Closing count resolution and bulk application.

If test infrastructure is added, prioritize unit tests for pure utilities and hook actions before broad UI tests.

## 12. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Behavior changes during extraction | Preserve existing handlers and verify each workflow after every phase. |
| Type migration slows feature work | Convert one feature boundary at a time and keep `allowJs` temporarily. |
| Prop drilling replaces the original problem | Group related state in feature hooks and use focused view props. |
| Duplicate state becomes inconsistent | Make one hook the owner of each feature's state and actions. |
| Large final migration becomes unreviewable | Convert and validate in small commits or reviewable stages. |
| Existing hidden bugs surface during typing | Separate migration fixes from unrelated behavioral changes and document them. |

## 13. Suggested Delivery Sequence

1. Baseline build and workflow verification.
2. Extract `Sidebar`.
3. Extract POS and restock modals.
4. Extract feature views.
5. Extract seed data.
6. Extract and type feature hooks.
7. Convert utilities to TypeScript.
8. Convert extracted components to TSX.
9. Convert `App.jsx` to `App.tsx`.
10. Remove `allowJs` and run final validation.

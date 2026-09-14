"use strict";

const { isInventoryChildPath } = require("./inventory-layout");

/**
 * Paste-over for Reborn `src/routes/inventory.tsx` (Lot parent):
 *
 *   const pathname = useRouterState({ select: (s) => s.location.pathname })
 *   const search = Route.useSearch()
 *   const role = useStore((s) => s.role)
 *   const vehicles = useStore((s) => s.vehicles)
 *   const deals = useStore((s) => s.deals)
 *   if (inventoryPageShouldOutlet(pathname)) {
 *     return typeof Outlet === "function" ? <Outlet /> : null
 *   }
 *
 * Call every hook above that return. Sibling unit URLs
 * (`/inventory/v-g3698a`, `/inventory/v-g3710`, …) keep this parent
 * mounted. Also guard Outlet — live `$id` layout is jsx(I) from the
 * index-Bhz1tsaJ barrel and I is undefined on a cold first paint.
 */
const inventoryPageShouldOutlet = isInventoryChildPath;

module.exports = { inventoryPageShouldOutlet };

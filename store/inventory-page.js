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
 *   if (inventoryPageShouldOutlet(pathname)) return <Outlet />
 *
 * Call every hook above that return. Sibling unit URLs
 * (`/inventory/v-g3698a`, `/inventory/v-g3710`, …) keep this parent
 * mounted; skipping hooks there is the same React #300 as G3709.
 */
const inventoryPageShouldOutlet = isInventoryChildPath;

module.exports = { inventoryPageShouldOutlet };

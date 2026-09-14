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
 */
const inventoryPageShouldOutlet = isInventoryChildPath;

module.exports = { inventoryPageShouldOutlet };

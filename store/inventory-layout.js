"use strict";

/**
 * Lot parent (`/_app/inventory` in the Reborn store).
 *
 * Live minified Se() in inventory-B-nxX0-L.js currently does:
 *
 *   const pathname = useRouterState(...)
 *   if (pathname.startsWith("/inventory/") && pathname !== "/inventory/") {
 *     return <Outlet />
 *   }
 *   const search = useSearch()
 *   useStore(...)
 *
 * Navigating /inventory → /inventory/v-g3709 keeps this parent mounted
 * (TanStack layout) but skips the later hooks. React 19 minified error #300
 * is "Rendered fewer hooks than expected." The overlay is transient because
 * the error boundary remounts; the child detail then paints.
 *
 * Always call the same hooks, then Outlet.
 */

function isInventoryChildPath(pathname) {
  const path = String(pathname || "");
  return path.startsWith("/inventory/") && path !== "/inventory/";
}

const INVENTORY_LAYOUT_HOOKS = [
  "useRouterState.pathname",
  "useSearch",
  "useStore.role",
  "useStore.vehicles",
  "useStore.deals",
];

function inventoryLayout(pathname, hooks) {
  const recorded = [];
  function call(name) {
    recorded.push(name);
    if (typeof hooks[name] === "function") return hooks[name]();
  }

  call("useRouterState.pathname");
  const search = call("useSearch") || {};
  const role = call("useStore.role");
  const vehicles = call("useStore.vehicles") || [];
  const deals = call("useStore.deals") || [];

  if (isInventoryChildPath(pathname)) {
    return { view: "outlet", hooks: recorded, search, role, vehicles, deals };
  }
  return { view: "lot", hooks: recorded, search, role, vehicles, deals };
}

/** The live bug — do not use. Kept so the regression test can lock the failure. */
function buggyInventoryLayout(pathname, hooks) {
  const recorded = [];
  function call(name) {
    recorded.push(name);
    if (typeof hooks[name] === "function") return hooks[name]();
  }

  call("useRouterState.pathname");
  if (isInventoryChildPath(pathname)) {
    return { view: "outlet", hooks: recorded };
  }
  call("useSearch");
  call("useStore.role");
  call("useStore.vehicles");
  call("useStore.deals");
  return { view: "lot", hooks: recorded };
}

module.exports = {
  INVENTORY_LAYOUT_HOOKS,
  isInventoryChildPath,
  inventoryLayout,
  buggyInventoryLayout,
};

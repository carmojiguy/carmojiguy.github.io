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

/**
 * Soft-nav the Lot parent the way TanStack keeps it mounted:
 * list → unit → list → sibling. Each step records hook names.
 */
function softNav(pathnames, layoutFn, hooks) {
  return (pathnames || []).map((pathname) => {
    const result = layoutFn(pathname, hooks) || {};
    return {
      pathname,
      view: result.view,
      hooks: Array.isArray(result.hooks) ? result.hooks.slice() : [],
    };
  });
}

/**
 * React #300 fires when a mounted parent changes hook count.
 * Names and length must be identical on every step, including
 * sibling unit details and the list return.
 */
function assertStableHookCounts(steps, expectedHooks) {
  const expected = expectedHooks || INVENTORY_LAYOUT_HOOKS;
  const rows = Array.isArray(steps) ? steps : [];
  for (const step of rows) {
    const actual = (step && step.hooks) || [];
    if (actual.length !== expected.length) {
      const err = new Error(
        `React #300: ${step.pathname} ran ${actual.length} hooks, expected ${expected.length}`,
      );
      err.code = "REACT_300";
      throw err;
    }
    for (let i = 0; i < expected.length; i++) {
      if (actual[i] !== expected[i]) {
        const err = new Error(
          `React #300: ${step.pathname} hook[${i}] was ${actual[i]}, expected ${expected[i]}`,
        );
        err.code = "REACT_300";
        throw err;
      }
    }
  }
  return rows;
}

function hookCountsDiverge(steps) {
  const lengths = (steps || []).map((step) => ((step && step.hooks) || []).length);
  return lengths.some((n) => n !== lengths[0]);
}

module.exports = {
  INVENTORY_LAYOUT_HOOKS,
  isInventoryChildPath,
  inventoryLayout,
  buggyInventoryLayout,
  softNav,
  assertStableHookCounts,
  hookCountsDiverge,
};

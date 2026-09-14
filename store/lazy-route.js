"use strict";

const { isRenderableType, safeType, createSafeElement } = require("./safe-element");

/**
 * Guard around live `lazyRouteComponent` (`O` in lazyRouteComponent-Bm2OwxAe.js):
 *
 *   r = mod[exportName]
 *   if (!r) use(importAgain())
 *   return createElement(r, props)   // r may still be undefined
 *
 * First open of `/inventory/$id` loads three lazy chunks:
 *   inventory-B-nxX0-L.js          (Lot parent, already warm from the list)
 *   inventory._id-D2Tmepus.js      (Outlet wrapper from the barrel)
 *   inventory._id.index-Dgq_el_5.js (unit detail + lucide splits)
 *
 * If `component` is missing on first eval, do not createElement(undefined).
 * Stay pending until the export is a function. Warm cache (desktop
 * NO_REPRO after hard reload) skips this race; cold first-paint does not.
 */
function resolveRouteExport(mod, exportName) {
  const key = exportName || "component";
  if (!mod || typeof mod !== "object") return null;
  const cand = mod[key] != null ? mod[key] : mod.default;
  return isRenderableType(cand) ? cand : null;
}

function paintLazyRoute(mod, createElement, props, exportName) {
  const Comp = resolveRouteExport(mod, exportName);
  if (!Comp) {
    return { status: "pending", type: null, element: null };
  }
  return {
    status: "ready",
    type: Comp,
    element: createSafeElement(createElement, Comp, props),
  };
}

/** Live bug — do not use. Locks createElement(undefined) on a cold chunk. */
function buggyLazyRoutePaint(mod, createElement, props, exportName) {
  const key = exportName || "component";
  const r = mod ? mod[key] : undefined;
  if (!r) {
    return { status: "pending", type: r, element: createElement(r, props || null) };
  }
  return { status: "ready", type: r, element: createElement(r, props || null) };
}

function FallbackOutlet() {
  return null;
}

function inventoryIdLayout(Outlet, createElement) {
  return createSafeElement(createElement, safeType(Outlet, FallbackOutlet), null);
}

module.exports = {
  resolveRouteExport,
  paintLazyRoute,
  buggyLazyRoutePaint,
  inventoryIdLayout,
  FallbackOutlet,
};

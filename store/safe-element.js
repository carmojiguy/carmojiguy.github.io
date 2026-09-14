"use strict";

/**
 * Never pass an undefined / promise type into createElement.
 *
 * React 19 maps "Rendered fewer hooks than expected" to minified **#300**.
 * Invalid element type is **#130** / lazy **#306**. ShawnBot's overlay
 * then recover matches both: TanStack's live lazy wrapper does
 * `createElement(r)` after `use(import())` even when `mod.component`
 * is still undefined (circular barrel / first paint).
 *
 * Live `$id` layout is `jsx(Outlet)` from `index-Bhz1tsaJ.js`.
 * Lucide splits (`chevron-left`, `plus`, `x`) call `createLucideIcon`
 * from that same barrel at module init.
 */

function NullRender() {
  return null;
}

function isRenderableType(type) {
  if (typeof type === "string" && type.trim()) return true;
  if (typeof type === "function") return true;
  if (!type || typeof type !== "object") return false;
  if (type.$$typeof) return true;
  if (typeof type.render === "function") return true;
  return false;
}

function safeType(type, fallback) {
  if (isRenderableType(type)) return type;
  if (isRenderableType(fallback)) return fallback;
  return NullRender;
}

function createSafeElement(createElement, type, props) {
  if (typeof createElement !== "function") {
    throw new Error("createSafeElement needs createElement");
  }
  return createElement(safeType(type), props || null);
}

module.exports = {
  NullRender,
  isRenderableType,
  safeType,
  createSafeElement,
};

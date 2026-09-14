"use strict";

const { isRenderableType, safeType } = require("./safe-element");

/**
 * Local SVG stand-ins so unit detail never depends on lucide chunks
 * (`chevron-left-DbmK54k9.js` etc.) or `createLucideIcon` from the
 * `index-Bhz1tsaJ.js` barrel. Those are undefined on first eval when
 * the barrel is still linking — then recover after remount.
 */
function svgIcon(name) {
  function Icon() {
    return { type: "svg", name };
  }
  Icon.displayName = name;
  return Icon;
}

const LotChevronLeft = svgIcon("chevron-left");
const LotChevronRight = svgIcon("chevron-right");
const LotPlus = svgIcon("plus");
const LotX = svgIcon("x");
const LotStar = svgIcon("star");

const LOT_ICON_FALLBACKS = {
  ChevronLeft: LotChevronLeft,
  ChevronRight: LotChevronRight,
  Plus: LotPlus,
  X: LotX,
  Star: LotStar,
};

function lucideOrFallback(createLucideIcon, name, fallback) {
  if (typeof createLucideIcon !== "function") return fallback;
  try {
    const icon = createLucideIcon(name, []);
    return isRenderableType(icon) ? icon : fallback;
  } catch {
    return fallback;
  }
}

function bindLotIcons(imports) {
  const src = imports && typeof imports === "object" ? imports : {};
  return {
    ChevronLeft: safeType(src.ChevronLeft, LotChevronLeft),
    ChevronRight: safeType(src.ChevronRight, LotChevronRight),
    Plus: safeType(src.Plus, LotPlus),
    X: safeType(src.X, LotX),
    Star: safeType(
      src.Star || lucideOrFallback(src.createLucideIcon, "star", LotStar),
      LotStar,
    ),
  };
}

module.exports = {
  LotChevronLeft,
  LotChevronRight,
  LotPlus,
  LotX,
  LotStar,
  LOT_ICON_FALLBACKS,
  lucideOrFallback,
  bindLotIcons,
};

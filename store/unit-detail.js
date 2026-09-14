"use strict";

const { formatDeskDay } = require("./desk-date");
const { normalizeVehicle } = require("./vehicle-seed-guard");
const { isRenderableType, safeType } = require("./safe-element");
const { bindLotIcons } = require("./lot-icons");

/**
 * Child unit detail (`inventory._id.index`, live Te()).
 * Hooks always run before the not-found return so missing / sibling /
 * floor vs no-floor units cannot change hook count.
 */
const UNIT_DETAIL_HOOKS = [
  "useParams.id",
  "useStore.vehicles",
  "useStore.role",
  "useNavigate",
];

function unitDetail(params, hooks) {
  const recorded = [];
  function call(name) {
    recorded.push(name);
    if (typeof hooks[name] === "function") return hooks[name]();
  }

  const id = call("useParams.id") || (params && params.id);
  const vehicles = call("useStore.vehicles") || [];
  call("useStore.role");
  call("useNavigate");

  const raw = vehicles.find((row) => row && row.id === id);
  if (!raw) {
    return { view: "not-found", hooks: recorded, id, vehicle: null, facts: null };
  }

  const vehicle = normalizeVehicle(raw);
  return {
    view: "detail",
    hooks: recorded,
    id,
    vehicle,
    facts: paintUnitFacts(vehicle),
  };
}

function paintUnitFacts(vehicle) {
  const unit = normalizeVehicle(vehicle);
  const buckets = unit.costBreakdown || {};
  return {
    title: [unit.year, unit.make, unit.model].filter(Boolean).join(" "),
    stock: unit.stock,
    km: `${Number(unit.km).toLocaleString("en-CA")} km`,
    bought: formatDeskDay(unit.boughtAt),
    floor: formatDeskDay(unit.floorDate),
    color: unit.color || "—",
    photos: Array.isArray(unit.photos) ? unit.photos.length : 0,
    hasFloor: unit.floorAmount != null && Number(unit.floorAmount) > 0,
    profitHint: Number(unit.price) - Number(buckets.purchase || 0),
  };
}

function FallbackPage() {
  return null;
}

function FallbackHeader() {
  return null;
}

/**
 * First paint of unit detail. Barrel / lucide imports may still be
 * undefined; every type we would pass to jsx() must stay renderable.
 */
function paintUnitRoute(vehicle, imports) {
  const src = imports && typeof imports === "object" ? imports : {};
  const icons = bindLotIcons(src);
  const Page = safeType(src.Page, FallbackPage);
  const Header = safeType(src.Header, FallbackHeader);
  const StatusBadge = safeType(src.StatusBadge, "span");
  const LotCost = safeType(src.LotCost, FallbackPage);
  const types = [Page, Header, StatusBadge, LotCost, icons.Plus, icons.Star];
  if (vehicle && Array.isArray(vehicle.photos) && vehicle.photos.length) {
    types.push(icons.ChevronLeft, icons.ChevronRight, icons.X);
  }
  const facts = vehicle ? paintUnitFacts(vehicle) : null;
  return {
    view: vehicle ? "detail" : "not-found",
    facts,
    icons,
    types,
    ok: types.every(isRenderableType),
  };
}

module.exports = {
  UNIT_DETAIL_HOOKS,
  unitDetail,
  paintUnitFacts,
  paintUnitRoute,
  FallbackPage,
  FallbackHeader,
};

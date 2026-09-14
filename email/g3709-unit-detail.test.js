#!/usr/bin/env node
"use strict";

const assert = require("assert");
const {
  INVENTORY_LAYOUT_HOOKS,
  isInventoryChildPath,
  inventoryLayout,
  buggyInventoryLayout,
} = require("../store/inventory-layout");
const { toIsoDate, formatDeskDay } = require("../store/desk-date");
const { normalizeVehicle, COST_KEYS } = require("../store/vehicle-seed-guard");

const hooks = {
  "useRouterState.pathname": () => "/inventory/v-g3709",
  useSearch: () => ({}),
  "useStore.role": () => "owner",
  "useStore.vehicles": () => [{ id: "v-g3709", stock: "G3709" }],
  "useStore.deals": () => [],
};

assert.equal(isInventoryChildPath("/inventory"), false);
assert.equal(isInventoryChildPath("/inventory/"), false);
assert.equal(isInventoryChildPath("/inventory/v-g3709"), true);
assert.equal(isInventoryChildPath("/inventory/new"), true);

const listBuggy = buggyInventoryLayout("/inventory", hooks);
const unitBuggy = buggyInventoryLayout("/inventory/v-g3709", hooks);
assert.equal(listBuggy.view, "lot");
assert.equal(unitBuggy.view, "outlet");
assert.notEqual(
  listBuggy.hooks.length,
  unitBuggy.hooks.length,
  "live Lot parent skips useSearch/useStore on unit URLs (React #300)",
);

const listFixed = inventoryLayout("/inventory", hooks);
const unitFixed = inventoryLayout("/inventory/v-g3709", hooks);
const newFixed = inventoryLayout("/inventory/new", hooks);
assert.equal(listFixed.view, "lot");
assert.equal(unitFixed.view, "outlet");
assert.equal(newFixed.view, "outlet");
assert.deepEqual(listFixed.hooks, INVENTORY_LAYOUT_HOOKS);
assert.deepEqual(unitFixed.hooks, INVENTORY_LAYOUT_HOOKS);
assert.deepEqual(newFixed.hooks, INVENTORY_LAYOUT_HOOKS);
assert.equal(listFixed.hooks.length, unitFixed.hooks.length);

const g3709 = normalizeVehicle({
  id: "v-g3709",
  stock: "G3709",
  year: 2022,
  make: "Hyundai",
  model: "ELANTRA SEL",
  trim: "",
  vin: "KMHLM4AG3NU228378",
  status: "available",
  cost: 16307.19,
  price: 18988,
  km: 88084,
  photo: "https://cdn.example/g3709-01.jpg",
  photos: [
    "https://cdn.example/g3709-01.jpg",
    "https://cdn.example/g3709-02.jpg",
    null,
    "",
  ],
  daysOnLot: 19,
  source: "Surdy",
  boughtAt: "8/17/26",
  boughtFrom: "",
  buyerStaffId: "",
  color: "",
  location: "Lot",
  type: "USED",
  floorAmount: null,
  floorDate: null,
  floorVendor: null,
  costBreakdown: { purchase: 16307.19, packs: 0, parts: 0, service: 0, labor: 0, gas: 0, other: 0 },
});

assert.equal(g3709.id, "v-g3709");
assert.equal(g3709.stock, "G3709");
assert.equal(g3709.boughtAt, "2026-08-17", "US short buy date becomes ISO so format.o cannot throw");
assert.equal(g3709.floorDate, null);
assert.equal(g3709.km, 88084);
assert.equal(g3709.color, "");
assert.equal(g3709.photos.length, 2);
assert.ok(!g3709.photos.includes(null));
COST_KEYS.forEach((key) => {
  assert.equal(typeof g3709.costBreakdown[key], "number");
});

const g3698a = normalizeVehicle({
  id: "v-g3698a",
  stock: "G3698A",
  cost: 7562.38,
  price: 13488,
  km: 164978,
  boughtAt: "8/05/26",
  floorDate: "8/19/26",
  floorAmount: 7000,
  floorVendor: "G2115",
  costBreakdown: { purchase: 7562.38 },
});
assert.equal(g3698a.boughtAt, "2026-08-05");
assert.equal(g3698a.floorDate, "2026-08-19");
assert.equal(g3698a.costBreakdown.packs, 0);

assert.equal(toIsoDate("8/17/26"), "2026-08-17");
assert.equal(toIsoDate("8/05/26"), "2026-08-05");
assert.equal(toIsoDate("2026-08-17"), "2026-08-17");
assert.equal(formatDeskDay("8/17/26"), formatDeskDay("2026-08-17"));
assert.equal(formatDeskDay(""), "—");
assert.equal(formatDeskDay(null), "—");
assert.doesNotThrow(() => formatDeskDay("not-a-date"));

const missingKm = normalizeVehicle({
  id: "v-broken",
  stock: "G0000",
  photos: [null, { url: "nope" }, "https://cdn.example/ok.jpg"],
});
assert.equal(missingKm.km, 0);
assert.deepEqual(missingKm.photos, ["https://cdn.example/ok.jpg"]);
assert.equal(missingKm.photo, "https://cdn.example/ok.jpg");

function renderUnitFacts(vehicle) {
  const unit = normalizeVehicle(vehicle);
  return {
    title: `${unit.year} ${unit.make} ${unit.model}`,
    stock: unit.stock,
    km: `${unit.km.toLocaleString("en-CA")} km`,
    bought: formatDeskDay(unit.boughtAt),
    photos: unit.photos.length,
    profitHint: unit.price - unit.costBreakdown.purchase,
  };
}

const painted = renderUnitFacts({
  id: "v-g3709",
  stock: "G3709",
  year: 2022,
  make: "Hyundai",
  model: "ELANTRA SEL",
  km: 88084,
  cost: 16307.19,
  price: 18988,
  boughtAt: "8/17/26",
  photo: "https://cdn.example/g3709-01.jpg",
  photos: new Array(25).fill(0).map((_, i) => `https://cdn.example/g3709-${String(i + 1).padStart(2, "0")}.jpg`),
  costBreakdown: { purchase: 16307.19, packs: 0, parts: 0, service: 0, labor: 0, gas: 0, other: 0 },
});
assert.equal(painted.title, "2022 Hyundai ELANTRA SEL");
assert.equal(painted.stock, "G3709");
assert.equal(painted.photos, 25);
assert.ok(painted.bought !== "—");
assert.ok(Number.isFinite(painted.profitHint));

console.log("g3709-unit-detail: ok");

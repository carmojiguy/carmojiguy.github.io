#!/usr/bin/env node
"use strict";

/**
 * LOT-DETAIL-REACT-300
 * Open /inventory/v-g3709 AND sibling unit details with no React #300
 * overlay; detail stays stable on soft nav return.
 */

const assert = require("assert");
const {
  INVENTORY_LAYOUT_HOOKS,
  inventoryLayout,
  buggyInventoryLayout,
  softNav,
  assertStableHookCounts,
  hookCountsDiverge,
} = require("../store/inventory-layout");
const { formatDeskDay } = require("../store/desk-date");
const { normalizeVehicle, normalizeLotVehicles } = require("../store/vehicle-seed-guard");
const { UNIT_DETAIL_HOOKS, unitDetail, paintUnitFacts } = require("../store/unit-detail");

const SIBLINGS = [
  {
    id: "v-g3709",
    stock: "G3709",
    year: 2022,
    make: "Hyundai",
    model: "ELANTRA SEL",
    vin: "KMHLM4AG3NU228378",
    status: "available",
    cost: 16307.19,
    price: 18988,
    km: 88084,
    photo: "https://cdn.example/g3709-01.jpg",
    photos: new Array(25).fill(0).map((_, i) => `https://cdn.example/g3709-${String(i + 1).padStart(2, "0")}.jpg`),
    boughtAt: "8/17/26",
    color: "",
    floorAmount: null,
    floorDate: null,
    floorVendor: null,
    costBreakdown: { purchase: 16307.19, packs: 0, parts: 0, service: 0, labor: 0, gas: 0, other: 0 },
  },
  {
    id: "v-g3698a",
    stock: "G3698A",
    year: 2018,
    make: "Nissan",
    model: "MURANO",
    km: 164978,
    cost: 7562.38,
    price: 13488,
    photos: ["https://cdn.example/g3698a-01.jpg", "https://cdn.example/g3698a-02.jpg"],
    boughtAt: "8/05/26",
    floorDate: "8/19/26",
    floorAmount: 7000,
    floorVendor: "G2115",
    costBreakdown: { purchase: 7562.38 },
  },
  {
    id: "v-g3710",
    stock: "G3710",
    year: 2020,
    make: "Nissan",
    model: "Rogue",
    km: 91200,
    cost: 14000,
    price: 17988,
    photos: new Array(25).fill(0).map((_, i) => `https://cdn.example/g3710-${i}.jpg`),
    boughtAt: "8/18/26",
    color: "",
    floorAmount: null,
    floorDate: null,
  },
  {
    id: "v-g3708",
    stock: "G3708",
    year: 2017,
    make: "Chevrolet",
    model: "Silverado",
    km: 140000,
    cost: 18000,
    price: 22988,
    photos: ["https://cdn.example/g3708.jpg"],
    boughtAt: "8/12/26",
  },
  {
    id: "v-g3707",
    stock: "G3707",
    year: 2020,
    make: "Hyundai",
    model: "Elantra Ultimate",
    km: 67000,
    cost: 15000,
    price: 18988,
    photos: ["https://cdn.example/g3707.jpg"],
    boughtAt: "8/10/26",
  },
  {
    id: "v-g3704",
    stock: "G3704",
    year: 2020,
    make: "Chevrolet",
    model: "Blazer",
    km: 88000,
    cost: 21000,
    price: 25988,
    photos: ["https://cdn.example/g3704.jpg"],
    boughtAt: "8/09/26",
    floorDate: "8/20/26",
    floorAmount: 15000,
    floorVendor: "G2115",
  },
  {
    id: "v-g3703",
    stock: "G3703",
    year: 2020,
    make: "Hyundai",
    model: "Kona",
    km: 54000,
    cost: 16000,
    price: 19988,
    photos: ["https://cdn.example/g3703.jpg"],
    boughtAt: "8/08/26",
  },
  {
    id: "v-g3657",
    stock: "G3657",
    year: 2017,
    make: "Honda",
    model: "CR-V Touring",
    km: 120000,
    cost: 17000,
    price: 21988,
    photos: ["https://cdn.example/g3657.jpg"],
    boughtAt: "8/01/26",
    floorDate: "8/15/26",
    floorAmount: 12000,
    floorVendor: "G2115",
  },
  {
    id: "v-g3774",
    stock: "G3774",
    year: 2022,
    make: "Ford",
    model: "F-150",
    km: 45000,
    cost: 32000,
    price: 38988,
    photos: ["https://cdn.example/g3774.jpg"],
    boughtAt: "8/21/26",
  },
];

const vehicles = normalizeLotVehicles(SIBLINGS);

const layoutHooks = {
  "useRouterState.pathname": () => "/inventory",
  useSearch: () => ({}),
  "useStore.role": () => "owner",
  "useStore.vehicles": () => vehicles,
  "useStore.deals": () => [],
};

const siblingPaths = SIBLINGS.map((row) => `/inventory/${row.id}`);

const SOFT_NAV = [
  "/inventory",
  "/inventory/v-g3709",
  "/inventory",
  "/inventory/v-g3698a",
  "/inventory/v-g3710",
  "/inventory/journey",
  "/inventory/new",
  "/inventory",
  ...siblingPaths,
  "/inventory",
];

const liveBug = softNav(SOFT_NAV, buggyInventoryLayout, layoutHooks);
assert.ok(
  hookCountsDiverge(liveBug),
  "live Lot parent still 300s on every sibling unit URL, not only G3709",
);
assert.equal(liveBug[0].hooks.length, INVENTORY_LAYOUT_HOOKS.length);
liveBug.filter((step) => step.pathname !== "/inventory").forEach((step) => {
  assert.equal(
    step.hooks.length,
    1,
    `live bug skips search/store on ${step.pathname}`,
  );
});

const fixed = softNav(SOFT_NAV, inventoryLayout, layoutHooks);
assert.doesNotThrow(() => assertStableHookCounts(fixed, INVENTORY_LAYOUT_HOOKS));
assert.equal(hookCountsDiverge(fixed), false);
fixed.forEach((step) => {
  assert.deepEqual(step.hooks, INVENTORY_LAYOUT_HOOKS);
  if (step.pathname === "/inventory") assert.equal(step.view, "lot");
  else assert.equal(step.view, "outlet");
});

const returnToList = fixed.filter((step) => step.pathname === "/inventory");
assert.ok(returnToList.length >= 3, "soft nav returns to the lot more than once");
returnToList.forEach((step) => {
  assert.deepEqual(step.hooks, INVENTORY_LAYOUT_HOOKS);
  assert.equal(step.view, "lot");
});

SIBLINGS.forEach((raw) => {
  const unit = normalizeVehicle(raw);
  const facts = paintUnitFacts(unit);
  assert.ok(facts.title.includes(String(raw.year)));
  assert.equal(facts.stock, raw.stock);
  assert.ok(facts.bought !== "—", `${raw.stock} boughtAt must format after ISO guard`);
  assert.doesNotThrow(() => formatDeskDay(raw.boughtAt));
  assert.doesNotThrow(() => formatDeskDay(raw.floorDate));
  assert.ok(Number.isFinite(facts.profitHint));
  assert.ok(facts.photos >= 1);

  const child = unitDetail({ id: raw.id }, {
    "useParams.id": () => raw.id,
    "useStore.vehicles": () => vehicles,
    "useStore.role": () => "owner",
    useNavigate: () => () => {},
  });
  assert.equal(child.view, "detail");
  assert.deepEqual(child.hooks, UNIT_DETAIL_HOOKS);
  assert.equal(child.facts.stock, raw.stock);
});

const missing = unitDetail({ id: "v-missing" }, {
  "useParams.id": () => "v-missing",
  "useStore.vehicles": () => vehicles,
  "useStore.role": () => "owner",
  useNavigate: () => () => {},
});
assert.equal(missing.view, "not-found");
assert.deepEqual(missing.hooks, UNIT_DETAIL_HOOKS);

const floorUnit = unitDetail({ id: "v-g3698a" }, {
  "useParams.id": () => "v-g3698a",
  "useStore.vehicles": () => vehicles,
  "useStore.role": () => "owner",
  useNavigate: () => () => {},
});
const noFloorUnit = unitDetail({ id: "v-g3709" }, {
  "useParams.id": () => "v-g3709",
  "useStore.vehicles": () => vehicles,
  "useStore.role": () => "owner",
  useNavigate: () => () => {},
});
assert.equal(floorUnit.facts.hasFloor, true);
assert.equal(noFloorUnit.facts.hasFloor, false);
assert.deepEqual(floorUnit.hooks, noFloorUnit.hooks);
assert.equal(noFloorUnit.facts.photos, 25);
assert.equal(floorUnit.facts.photos, 2);

console.log("lot-detail-react-300: ok");

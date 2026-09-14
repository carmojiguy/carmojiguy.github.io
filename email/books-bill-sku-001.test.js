#!/usr/bin/env node
"use strict";

/**
 * BOOKS-BILL-SKU-001 regression
 * SORT-WO PASS: Receive/bill NAPA-ROT-992 → allocate WO-1043 → stock search finds a row.
 * Qty 0 / allocated-to-WO is OK. Missing row is not.
 */

const assert = require("assert");
const idx = require("../books/parts-stock-index");

const SEED_SHELF = [
  { id: "p-1", sku: "HON-BRK-390", desc: "Front pad set ceramic — Honda", qty: 3, min: 2, cost: 48, sell: 129, supplier: "NAPA Autopro", bin: "A-12" },
  { id: "p-8", sku: "WIP-22", desc: "Wiper blade 22\"", qty: 0, min: 6, cost: 7, sell: 18, supplier: "UAP", bin: "B-11" },
];

const NAPA = {
  sku: "NAPA-ROT-992",
  desc: "Front rotor pair — Honda 17-22",
  qty: 2,
  cost: 67.4,
  supplier: "NAPA Autopro",
  vendorName: "NAPA Autopro",
};

const UAP = {
  sku: "UAP-FLT-220",
  desc: "Oil filter Honda / Acura",
  qty: 12,
  cost: 6.1,
  supplier: "UAP",
};

function sortWoReceive(parts, intake, woId) {
  // Live path: scanInvoice → setPartDestination({ kind: "work_order", id: woId })
  const nextParts = idx.partsAfterDestination(parts, intake, "work_order", "2026-09-14T12:00:00-04:00");
  const woLine = { id: "pl-new", sku: intake.sku, desc: intake.desc, qty: intake.qty, cost: intake.cost };
  return {
    parts: nextParts,
    workOrders: [{ id: woId, number: "WO-1043", parts: [woLine] }],
    journals: [{
      id: "j-part-" + intake.sku + "-2026-09-14",
      memo: "Parts in " + intake.sku + " · " + woId,
      source: "parts:" + intake.sku,
    }],
  };
}

const afterNapa = sortWoReceive(SEED_SHELF, NAPA, "wo-1043");
const napaHits = idx.searchStock(afterNapa.parts, "NAPA-ROT-992");
assert.equal(napaHits.length, 1, "stock search NAPA-ROT-992 returns a row after WO allocate");
assert.equal(napaHits[0].sku, "NAPA-ROT-992");
assert.equal(napaHits[0].desc, NAPA.desc);
assert.equal(napaHits[0].qty, 0, "on-hand 0 is OK when the qty is on the WO");
assert.ok(napaHits[0].lastReceived, "row keeps a lastReceived stamp");

const partial = idx.searchStock(afterNapa.parts, "ROT-992");
assert.equal(partial.length, 1, "partial SKU search still hits the row");

const descHit = idx.searchStock(afterNapa.parts, "Front rotor");
assert.equal(descHit.length, 1, "description search finds the billed SKU");

const afterSibling = sortWoReceive(afterNapa.parts, UAP, "wo-1043");
assert.equal(idx.searchStock(afterSibling.parts, "UAP-FLT-220").length, 1, "sibling billed SKU is findable");
assert.equal(idx.searchStock(afterSibling.parts, "NAPA-ROT-992").length, 1, "first billed SKU stays findable");

const shelf = idx.partsAfterDestination(SEED_SHELF, NAPA, "shelf", "2026-09-14T12:00:00-04:00");
assert.equal(idx.searchStock(shelf, "NAPA-ROT-992")[0].qty, 2, "shelf destination still books on-hand");

const headersOnly = idx.searchStock(SEED_SHELF, "NAPA-ROT-992");
assert.equal(headersOnly.length, 0, "pre-fix catalog (seed shelf only) is the failing live state");

const persisted = {
  parts: SEED_SHELF.slice(),
  workOrders: afterNapa.workOrders,
  journals: afterNapa.journals,
};
const repaired = idx.backfillBilledStockRows(persisted.parts, persisted.journals, persisted.workOrders);
assert.equal(
  idx.searchStock(repaired, "NAPA-ROT-992").length,
  1,
  "hydrate backfill restores a row when SORT-WO already posted parts-in and skipped the catalog"
);
assert.equal(idx.searchStock(repaired, "NAPA-ROT-992")[0].qty, 0);

const journalCountBefore = afterNapa.journals.length;
idx.partsAfterDestination(afterNapa.parts, NAPA, "work_order");
assert.equal(afterNapa.journals.length, journalCountBefore, "helper does not append BOOKS-004 journals");

const existingPads = idx.partsAfterDestination(SEED_SHELF, {
  sku: "HON-BRK-390",
  desc: "Front pad set ceramic — Honda",
  qty: 1,
  cost: 48,
  supplier: "NAPA Autopro",
}, "work_order");
assert.equal(existingPads.filter(function (p) { return p.sku === "HON-BRK-390"; }).length, 1, "no duplicate catalog row");
assert.equal(existingPads.find(function (p) { return p.sku === "HON-BRK-390"; }).qty, 3, "WO allocate does not steal existing shelf qty");

assert.equal(idx.isOffShelfDestination("work_order"), true);
assert.equal(idx.isOffShelfDestination("shelf"), false);

console.log("BOOKS-BILL-SKU-001 ok");

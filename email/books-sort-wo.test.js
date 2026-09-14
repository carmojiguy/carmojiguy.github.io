#!/usr/bin/env node
"use strict";

/**
 * BOOKS-SORT-WO-001
 * Vendor bill Post dest must include Work Order. Select WO → cost lands on that WO.
 * Receive → WO alone is NOT full PASS (that path already works on WO-1043).
 */

const assert = require("assert");
const Bill = require("../books/vendor-bill-wo");
const idx = require("../books/parts-stock-index");

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const WO1043 = {
  id: "wo-1043",
  number: "WO-1043",
  type: "service",
  status: "open",
  concern: "Check engine on — P0171 system too lean bank 1",
  parts: [
    { id: "pl-1043a", sku: "TOY-PCV-2AZ", desc: "PCV valve 2AZ-FE", qty: 1, cost: 18, sell: 42 },
  ],
};

const CAMRY = {
  id: "v-camry15",
  stock: "G1043",
  year: 2015,
  make: "Toyota",
  model: "Camry",
  vin: "4T1BF1FK5FU000104",
  reconCost: 0,
};

function seedState() {
  return {
    invoices: [],
    journals: [],
    workOrders: [JSON.parse(JSON.stringify(WO1043))],
    vehicles: [Object.assign({}, CAMRY)],
    parts: [
      { id: "p-1", sku: "HON-BRK-390", desc: "Front pad set ceramic — Honda", qty: 3, min: 2, cost: 48, sell: 129, supplier: "NAPA Autopro", bin: "A-12" },
    ],
    unitEvents: [],
    _seq: 1,
  };
}

assert.deepEqual(
  Bill.destLabels(Bill.LIVE_BILL_DESTS),
  ["Parts shelf", "A stock number", "Krown supplies", "Overhead"],
  "live Post picker (from accounting-CymDpuHW.js Jt) has no Work Order"
);
assert.equal(Bill.hasWorkOrderDest(Bill.LIVE_BILL_DESTS), false, "live dest list fails SORT-WO");

assert.equal(Bill.hasWorkOrderDest(Bill.BILL_DESTS), true, "patched dest list includes Work Order");
assert.equal(Bill.BILL_DESTS[0].id, "wo");
assert.equal(Bill.BILL_DESTS[0].label, "Work Order");
assert.equal(Bill.BILL_GL.wo, "1200");
assert.equal(Bill.destDesk("wo"), "service");

assert.deepEqual(
  Bill.destLabels(Bill.RECEIVE_DESTS),
  ["Work order", "Stock", "Department"],
  "Parts Receive dests stay WO | Stock | Department"
);

assert.equal(Bill.LIVE_POST_BILL_GATES_DESTS_ON_PHOTO, true, "live job=bill hides dests until a photo");
const liveScreen = Bill.livePostBillScreen();
assert.equal(liveScreen.destsVisible, false, "ShawnBot URL: Camera/Upload only, no dest picker");
assert.equal(liveScreen.camera, true);
assert.equal(liveScreen.upload, true);

const emptyPost = Bill.postBillScreen({
  source: null,
  apply: "wo",
  workOrders: [JSON.parse(JSON.stringify(WO1043))],
});
assert.equal(emptyPost.destsVisible, true, "patched job=bill shows dests with Camera/Upload");
assert.ok(emptyPost.destLabels.indexOf("Work Order") === 0, "Work Order is a dest on the empty Post bill card");
assert.equal(emptyPost.woPicker, true);
assert.equal(emptyPost.canSubmit, false, "still no journal without a photo");
assert.ok(Bill.renderDestChipsHtml("wo").indexOf("data-dest=\"wo\"") >= 0);
assert.ok(Bill.renderDestChipsHtml("wo").indexOf("Work Order") >= 0);

const source = { name: "napa.jpg", mime: "image/jpeg", dataUrl: PNG };
const billInput = {
  vendor: "NAPA Autopro",
  apply: "wo",
  woId: "wo-1043",
  net: 134.8,
  tax: 17.52,
  invoiceNo: "NA-992",
  sku: "NAPA-ROT-992",
  desc: "Front rotor pair — Honda 17-22",
  qty: 2,
  source: source,
};

const missingWo = Bill.validateVendorBill(
  Object.assign({}, billInput, { woId: undefined }),
  [],
  [],
  seedState().workOrders
);
assert.equal(missingWo.ok, false);
assert.match(missingWo.error, /work order/i);

const noPhoto = Bill.validateVendorBill(Object.assign({}, billInput, { source: {} }), [], [], seedState().workOrders);
assert.equal(noPhoto.ok, false, "OCR/photo path still requires an image");

const posted = Bill.postVendorBill(seedState(), billInput, { date: "2026-09-14", user: "u-christine" });
assert.equal(posted.ok, true, "posts");
assert.equal(posted.invoice.apply, "wo");
assert.equal(posted.invoice.woId, "wo-1043");
assert.equal(posted.invoice.glAccount, "1200");
assert.equal(posted.workOrder.number, "WO-1043");

const landed = posted.workOrder.parts.filter(function (p) {
  return p.sku === "NAPA-ROT-992";
});
assert.equal(landed.length, 1, "bill cost line lands on WO-1043");
assert.equal(landed[0].qty, 2);
assert.equal(landed[0].cost, 67.4);
assert.equal(posted.workOrder.parts.length, 2, "existing WO parts stay");

assert.ok(posted.journal.memo.indexOf("WO-1043") >= 0, "journal memo names the WO");
assert.ok(posted.journal.source.indexOf("bill:") === 0, "journal is a vendor bill, not a BOOKS-004 extra");
const dr1200 = posted.journal.lines.find(function (l) {
  return l.account === "1200" && l.debit > 0;
});
assert.ok(dr1200, "Dr 1200 parts");
assert.equal(dr1200.dept, "service");
const crAp = posted.journal.lines.find(function (l) {
  return l.account === "2000" && l.credit > 0;
});
assert.equal(crAp.credit, 152.32);

const skuHits = idx.searchStock(posted.state.parts, "NAPA-ROT-992");
assert.equal(skuHits.length, 1, "BILL-SKU: billed SKU stays searchable after bill→WO");
assert.equal(skuHits[0].qty, 0, "qty 0 on the shelf is OK");

const ocrApply = Bill.applyFromScanText("Invoice WO-1043 NAPA Autopro rotors", "NAPA Autopro");
assert.equal(ocrApply, "wo", "photo/OCR scan that names a WO suggests Work Order dest");

const ocrPosted = Bill.postVendorBill(seedState(), {
  vendor: "Kal Tire",
  apply: Bill.applyFromScanText("WO-1043 alignment", "Kal Tire"),
  woNumber: "WO-1043",
  net: 89,
  tax: 11.57,
  invoiceNo: "KT-441",
  source: source,
}, { date: "2026-09-14" });
assert.equal(ocrPosted.ok, true);
assert.equal(ocrPosted.invoice.woId, "wo-1043");
assert.equal(ocrPosted.workOrder.parts[ocrPosted.workOrder.parts.length - 1].cost, 89);

const shelf = Bill.postVendorBill(seedState(), {
  vendor: "NAPA Autopro",
  apply: "parts",
  net: 48,
  tax: 6.24,
  invoiceNo: "NA-SHELF",
  source: source,
});
assert.equal(shelf.ok, true);
assert.equal(shelf.invoice.apply, "parts");
assert.equal(shelf.invoice.woId, undefined);
assert.equal(shelf.state.workOrders[0].parts.length, 1, "parts-shelf bill does not touch the WO");

const stockBill = Bill.postVendorBill(seedState(), {
  vendor: "OpenLane",
  apply: "stock",
  vehicleId: "v-camry15",
  net: 220,
  tax: 28.6,
  invoiceNo: "OL-9",
  source: source,
});
assert.equal(stockBill.ok, true);
assert.equal(stockBill.state.vehicles[0].reconCost, 220, "stock dest still hits recon");

const receive = Bill.setPartDestination(
  {
    pendingIntake: {
      sku: "NAPA-ROT-992",
      desc: "Front rotor pair — Honda 17-22",
      qty: 2,
      cost: 67.4,
      supplier: "NAPA Autopro",
    },
    workOrders: [JSON.parse(JSON.stringify(WO1043))],
    vehicles: [Object.assign({}, CAMRY)],
    parts: seedState().parts,
    journals: [],
  },
  { kind: "work_order", id: "wo-1043" },
  { date: "2026-09-14" }
);
assert.equal(receive.ok, true, "Receive → WO still works");
assert.equal(receive.state.workOrders[0].parts.slice(-1)[0].sku, "NAPA-ROT-992");
assert.equal(idx.searchStock(receive.state.parts, "NAPA-ROT-992")[0].qty, 0);
assert.equal(receive.journal.source, "parts:NAPA-ROT-992", "receive still uses parts-in journal, not bill:");

const receiveStock = Bill.setPartDestination(
  {
    pendingIntake: { sku: "OIL-5W30", desc: "Oil 5W30", qty: 1, cost: 8, supplier: "UAP" },
    workOrders: [JSON.parse(JSON.stringify(WO1043))],
    vehicles: [Object.assign({}, CAMRY)],
    parts: seedState().parts,
    journals: [],
  },
  { kind: "stock_number", id: "G1043" },
  { date: "2026-09-14" }
);
assert.ok(receiveStock.state.vehicles[0].reconCost > 0, "Receive → Stock still books recon");
assert.equal(receiveStock.state.workOrders[0].parts.length, 1, "stock dest does not add a WO line");

const receiveDept = Bill.setPartDestination(
  {
    pendingIntake: { sku: "GLOVE-L", desc: "Nitrile gloves", qty: 10, cost: 1.2, supplier: "UAP" },
    workOrders: [JSON.parse(JSON.stringify(WO1043))],
    vehicles: [Object.assign({}, CAMRY)],
    parts: seedState().parts,
    journals: [],
  },
  { kind: "department", id: "overhead" },
  { date: "2026-09-14" }
);
assert.equal(receiveDept.ok, true, "Receive → Department still posts");
assert.equal(receiveDept.state.workOrders[0].parts.length, 1, "department dest does not add a WO line");
assert.equal(receiveDept.journal.lines[0].account, "1200");

const journalCount = posted.state.journals.length;
Bill.postVendorBill(posted.state, billInput);
assert.equal(posted.state.journals.length, journalCount, "helper does not append BOOKS-004 journals on the prior state");

console.log("BOOKS-SORT-WO-001 ok");

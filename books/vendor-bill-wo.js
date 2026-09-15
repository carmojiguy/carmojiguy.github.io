"use strict";

/**
 * BOOKS-SORT-WO-001 — Vendor bill Post destination includes Work Order.
 *
 * Live OS (birch-lake-zinc-dawn.grok.me) accounting Post → Vendor bill dest
 * chips are only:
 *
 *   parts | stock | krown | overhead
 *   Parts shelf | A stock number | Krown supplies | Overhead
 *
 * There is no Work Order. Receive already dests WO | Stock | Department
 * (app.js Lt() → setPartDestination). That path is NOT full SORT-WO PASS.
 *
 * Photo/OCR and typed review share one dest list (accounting Yt form).
 * Selecting WO must: set invoice.woId, push a cost line onto that WO,
 * journal Dr 1200 + ITC 1400 / Cr AP 2000 with the WO number in the memo.
 *
 * Sibling BILL-SKU (books/parts-stock-index.js): when the bill carries a SKU,
 * keep a searchable catalog row (qty 0 OK). Do not drop that index.
 *
 * HOLD: Deliver / BOOKS-004. Do not invent extra journals.
 */

var stockIndex = require("./parts-stock-index");

var LIVE_BILL_DESTS = [
  { id: "parts", label: "Parts shelf", hint: "Dr 1200 · sits until a RO uses it" },
  { id: "stock", label: "A stock number", hint: "Recon on the VIN · Dr 1100" },
  { id: "krown", label: "Krown supplies", hint: "Dr 5700" },
  { id: "overhead", label: "Overhead", hint: "Rent, hydro, phones · Dr 5300" },
];

var BILL_DESTS = [
  { id: "wo", label: "Work Order", hint: "Dr 1200 · cost on the RO until invoiced" },
  { id: "parts", label: "Parts shelf", hint: "Dr 1200 · sits until a RO uses it" },
  { id: "stock", label: "A stock number", hint: "Recon on the VIN · Dr 1100" },
  { id: "krown", label: "Krown supplies", hint: "Dr 5700" },
  { id: "overhead", label: "Overhead", hint: "Rent, hydro, phones · Dr 5300" },
];

var BILL_GL = { wo: "1200", parts: "1200", stock: "1100", krown: "5700", overhead: "5300" };

var RECEIVE_DESTS = [
  { id: "work_order", label: "Work order" },
  { id: "stock_number", label: "Stock" },
  { id: "department", label: "Department" },
];

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function destDesk(apply) {
  if (apply === "stock") return "sales";
  if (apply === "parts") return "parts";
  if (apply === "krown") return "crown";
  if (apply === "wo") return "service";
  return "overhead";
}

function destLabels(dests) {
  return (dests || []).map(function (d) {
    return d.label;
  });
}

function hasWorkOrderDest(dests) {
  return (dests || []).some(function (d) {
    return d.id === "wo" || /^work order$/i.test(d.label);
  });
}

function findWorkOrder(workOrders, woId, woNumber) {
  var id = String(woId || "").trim();
  var num = String(woNumber || "").trim().toUpperCase();
  return (workOrders || []).find(function (wo) {
    if (id && wo.id === id) return true;
    if (num && String(wo.number || "").toUpperCase() === num) return true;
    if (num && String(wo.number || "").toUpperCase() === "WO-" + num.replace(/^WO-/, "")) return true;
    return false;
  });
}

function findVehicle(vehicles, input) {
  if (input && input.vehicleId) {
    var byId = (vehicles || []).find(function (v) {
      return v.id === input.vehicleId;
    });
    if (byId) return byId;
  }
  var stock = String((input && input.stock) || "").trim().toUpperCase();
  if (stock) {
    var byStock = (vehicles || []).find(function (v) {
      return String(v.stock || "").toUpperCase() === stock;
    });
    if (byStock) return byStock;
  }
  var vin = String((input && input.vin) || "").replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
  if (vin.length >= 8) {
    return (vehicles || []).find(function (v) {
      var vv = String(v.vin || "").replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
      return vv === vin || vv.endsWith(vin);
    });
  }
}

function duplicateVendorInvoice(invoices, vendor, invoiceNo) {
  var no = String(invoiceNo || "").trim().toLowerCase();
  if (!no) return;
  var party = String(vendor || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return (invoices || []).find(function (inv) {
    return (
      inv.kind === "vendor" &&
      String(inv.party || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === party &&
      String(inv.invoiceNo || "").trim().toLowerCase() === no
    );
  });
}

function validateVendorBill(input, invoices, vehicles, workOrders) {
  if (!input || !input.source || !input.source.dataUrl) {
    return { ok: false, error: "No image, no journal. Photo or scan the invoice first." };
  }
  if (!String((input && input.vendor) || "").trim()) {
    return { ok: false, error: "Need a vendor on the scan." };
  }
  if (!(Number(input.net) > 0) && !(Number(input.tax) > 0)) {
    return { ok: false, error: "Scan didn’t give an amount. Check the photo." };
  }
  var dup = duplicateVendorInvoice(invoices, input.vendor, input.invoiceNo);
  if (dup) {
    return { ok: false, error: "Already posted " + dup.number + " for " + dup.party + " · " + dup.invoiceNo };
  }
  if (input.apply === "stock" && !findVehicle(vehicles, input)) {
    return { ok: false, error: "A stock bill needs a VIN or stock number." };
  }
  if (input.apply === "wo" && !findWorkOrder(workOrders, input.woId, input.woNumber)) {
    return { ok: false, error: "A work-order bill needs a work order." };
  }
  return { ok: true };
}

function journalFromVendorBill(input, ids) {
  var net = round2(input.net);
  var tax = round2(input.tax);
  var gl = input.glAccount || BILL_GL[input.apply] || BILL_GL.parts;
  var desk = destDesk(input.apply);
  var woBit = input.woNumber ? " · " + input.woNumber : "";
  var stockBit = input.stock ? " · " + input.stock : "";
  return {
    id: ids.journalId,
    date: input.date,
    memo:
      String(input.vendor || "").trim() +
      (input.invoiceNo ? " · " + input.invoiceNo : "") +
      woBit +
      stockBit,
    source: "bill:" + ids.invoiceId,
    createdBy: input.createdBy,
    attachment: input.source,
    lines: [
      { account: gl, debit: net, credit: 0, dept: desk },
      { account: "1400", debit: tax, credit: 0 },
      { account: "2000", debit: 0, credit: round2(net + tax) },
    ],
  };
}

function woCostLine(input, lineId) {
  var sku = String(input.sku || "").trim();
  var qty = input.qty == null ? 1 : Number(input.qty);
  if (!isFinite(qty) || qty < 0) qty = 1;
  var net = round2(input.net);
  var unit = qty > 0 ? round2(net / qty) : net;
  return {
    id: lineId,
    sku: sku || (input.invoiceNo ? "BILL-" + String(input.invoiceNo).trim() : "BILL"),
    desc: input.desc || (String(input.vendor || "").trim() + (input.invoiceNo ? " · " + input.invoiceNo : "")),
    qty: qty,
    cost: unit,
    sell: qty > 0 ? round2(unit * 1.67) : 0,
    billId: input.billId,
  };
}

function nextId(prefix, n) {
  return prefix + "-" + String(n).padStart(4, "0");
}

/**
 * End-to-end vendor bill post. Photo/OCR and review share this apply id.
 * apply: wo | parts | stock | krown | overhead
 */
function postVendorBill(state, input, clock) {
  var invoices = (state && state.invoices) || [];
  var vehicles = (state && state.vehicles) || [];
  var workOrders = ((state && state.workOrders) || []).map(function (wo) {
    return Object.assign({}, wo, { parts: (wo.parts || []).slice() });
  });
  var check = validateVendorBill(input, invoices, vehicles, workOrders);
  if (!check.ok) return check;

  var seq = (state && state._seq) || 1;
  var invoiceId = input.id || nextId("inv", seq);
  var journalId = input.journalId || nextId("j", seq);
  var lineId = input.lineId || nextId("pl", seq);
  var date = (clock && clock.date) || input.invoiceDate || "2026-09-14";
  var net = round2(input.net);
  var tax = round2(input.tax);
  var vehicle = input.apply === "stock" ? findVehicle(vehicles, input) : null;
  var wo = input.apply === "wo" ? findWorkOrder(workOrders, input.woId, input.woNumber) : null;
  var gl = input.glAccount || BILL_GL[input.apply];
  var journal = journalFromVendorBill(
    Object.assign({}, input, {
      date: date,
      createdBy: (clock && clock.user) || input.createdBy || "u-christine",
      glAccount: gl,
      stock: (vehicle && vehicle.stock) || input.stock,
      woNumber: wo && wo.number,
      source: input.source,
    }),
    { invoiceId: invoiceId, journalId: journalId }
  );

  var invoice = {
    id: invoiceId,
    kind: "vendor",
    number: "BILL-" + String(invoiceId).slice(-6).toUpperCase(),
    date: date,
    party: String(input.vendor).trim(),
    apply: input.apply,
    stock: vehicle && vehicle.stock,
    vehicleId: vehicle && vehicle.id,
    woId: wo && wo.id,
    sku: input.sku || undefined,
    invoiceNo: String(input.invoiceNo || "").trim() || undefined,
    dueDate: String(input.dueDate || "").trim() || undefined,
    glAccount: gl,
    net: net,
    tax: tax,
    total: round2(net + tax),
    memo: input.memo || "",
    journalId: journal.id,
    status: "posted",
    source: input.source,
  };

  var parts = ((state && state.parts) || []).slice();
  var unitEvents = ((state && state.unitEvents) || []).slice();
  var nextVehicles = vehicles.slice();

  if (wo) {
    var line = woCostLine(
      Object.assign({}, input, { billId: invoice.id }),
      lineId
    );
    wo = Object.assign({}, wo, { parts: wo.parts.concat([line]) });
    workOrders = workOrders.map(function (row) {
      return row.id === wo.id ? wo : row;
    });
    if (input.sku) {
      parts = stockIndex.partsAfterDestination(
        parts,
        {
          sku: input.sku,
          desc: input.desc || line.desc,
          qty: input.qty == null ? 1 : input.qty,
          cost: line.cost,
          supplier: input.vendor,
        },
        "work_order",
        date
      );
    }
  }

  if (vehicle && input.apply === "stock") {
    nextVehicles = vehicles.map(function (v) {
      if (v.id !== vehicle.id) return v;
      return Object.assign({}, v, { reconCost: round2((v.reconCost || 0) + net) });
    });
    unitEvents = [
      {
        id: nextId("ue", seq),
        vehicleId: vehicle.id,
        type: "recon_cost",
        sourceModule: "books",
        journalId: journal.id,
        amount: net,
        glAccounts: ["1100", "1400", "2000"],
        note: invoice.party + (invoice.invoiceNo ? " · " + invoice.invoiceNo : ""),
      },
    ].concat(unitEvents);
  }

  return {
    ok: true,
    invoice: invoice,
    journal: journal,
    workOrder: wo || null,
    state: {
      invoices: [invoice].concat(invoices),
      journals: [journal].concat((state && state.journals) || []),
      workOrders: workOrders,
      vehicles: nextVehicles,
      parts: parts,
      unitEvents: unitEvents,
      _seq: seq + 1,
    },
  };
}

function includedHst(gross) {
  var g = round2(gross);
  var net = round2(g / 1.13);
  return { net: net, tax: round2(g - net) };
}

function partsInJournal(part, dest, user, date) {
  var gross = round2((part.cost || 0) * (part.qty || 0));
  var split = includedHst(gross);
  var gl = dest.kind === "stock_number" ? "1100" : "1200";
  var desk = dest.kind === "stock_number" ? "sales" : "parts";
  return {
    id: "j-part-" + part.sku + "-" + date,
    date: date,
    memo: "Parts in " + part.sku + (dest.id ? " · " + dest.id : ""),
    source: "parts:" + part.sku,
    createdBy: user,
    lines: [
      { account: gl, debit: split.net, credit: 0, dept: desk },
      { account: "1400", debit: split.tax, credit: 0 },
      { account: "2000", debit: 0, credit: round2(split.net + split.tax) },
    ],
  };
}

/**
 * Receive dest WO | Stock | Department — live already works. Keep it.
 * Catalog row uses BILL-SKU helper so WO allocate still leaves a searchable SKU.
 */
function setPartDestination(state, dest, clock) {
  var intake = state && state.pendingIntake;
  if (!intake || !dest || !dest.kind) return { ok: false, error: "Need a destination." };
  var date = (clock && clock.date) || new Date().toISOString().slice(0, 10);
  var user = (clock && clock.user) || "u-christine";
  var part = {
    id: intake.partId || "p-" + String(intake.sku || "").toLowerCase(),
    sku: intake.sku,
    desc: intake.desc,
    qty: intake.qty,
    min: 1,
    cost: intake.cost,
    sell: round2((intake.cost || 0) * 1.67),
    supplier: intake.supplier,
    lastReceived: date,
  };
  var line = {
    id: intake.lineId || "pl-" + String(intake.sku || "").toLowerCase(),
    sku: intake.sku,
    desc: intake.desc,
    qty: intake.qty,
    cost: intake.cost,
    sell: part.sell,
  };
  var journal = partsInJournal(part, dest, user, date);
  var workOrders = ((state && state.workOrders) || []).map(function (wo) {
    return Object.assign({}, wo, { parts: (wo.parts || []).slice() });
  });
  var vehicles = ((state && state.vehicles) || []).slice();
  var unitEvents = ((state && state.unitEvents) || []).slice();

  if (dest.kind === "work_order") {
    workOrders = workOrders.map(function (wo) {
      if (wo.id !== dest.id) return wo;
      return Object.assign({}, wo, { parts: wo.parts.concat([line]) });
    });
  }
  if (dest.kind === "stock_number") {
    var split = includedHst((part.cost || 0) * (part.qty || 0));
    vehicles = vehicles.map(function (v) {
      if (v.stock !== dest.id && v.id !== dest.id) return v;
      return Object.assign({}, v, { reconCost: round2((v.reconCost || 0) + split.net) });
    });
  }

  var parts = stockIndex.partsAfterDestination((state && state.parts) || [], intake, dest.kind, date);

  return {
    ok: true,
    journal: journal,
    state: {
      pendingIntake: null,
      parts: parts,
      workOrders: workOrders,
      vehicles: vehicles,
      unitEvents: unitEvents,
      journals: [journal].concat((state && state.journals) || []),
    },
  };
}

function applyFromScanText(text, vendor) {
  var blob = String(text || "") + " " + String(vendor || "");
  if (/\bWO[-\s]?\d{3,}\b/i.test(blob)) return "wo";
  var t = blob.toLowerCase();
  if (/krown|crown rust/.test(t)) return "krown";
  if (/napa|uap|parts|kal tire|tire|filter|oil/.test(t)) return "parts";
  if (/openlane|eblock|adesa|manheim|auction|wholesale/.test(t)) return "stock";
  if (/hydro|bell|rogers|rent|insurance|telus|enbridge/.test(t)) return "overhead";
  return "parts";
}

/**
 * Live Yt form (accounting-CymDpuHW.js): dest chips live inside `source && …`.
 * `/accounting?view=post&job=bill` therefore shows Camera/Upload only —
 * ShawnBot + CoS 2026-09-14 full FAIL. Receive→WO is a different screen.
 */
var LIVE_POST_BILL_GATES_DESTS_ON_PHOTO = true;

function livePostBillScreen() {
  return {
    url: "/accounting?view=post&job=bill",
    destsVisible: false,
    dests: [],
    camera: true,
    upload: true,
    reason: "dest chips gated on photo/PDF source",
  };
}

/**
 * Patched Post → Vendor bill screen. Dest picker is on the card with
 * Camera/Upload — not hidden until a scan. Photo is still required to post.
 */
function postBillScreen(opts) {
  var apply = (opts && opts.apply) || "wo";
  var source = opts && opts.source;
  var workOrders = ((opts && opts.workOrders) || []).filter(function (wo) {
    return wo.status !== "closed";
  });
  var woId = (opts && opts.woId) || (workOrders[0] && workOrders[0].id) || "";
  return {
    url: "/accounting?view=post&job=bill",
    title: "Vendor bill",
    destsVisible: true,
    dests: BILL_DESTS,
    destLabels: destLabels(BILL_DESTS),
    apply: apply,
    woPicker: apply === "wo",
    woId: woId,
    openWorkOrders: workOrders,
    camera: true,
    upload: true,
    canSubmit: !!(source && source.dataUrl),
  };
}

function renderDestChipsHtml(apply) {
  var current = apply || "wo";
  return BILL_DESTS.map(function (d) {
    var on = d.id === current;
    return (
      '<button type="button" data-dest="' +
      d.id +
      '" class="chip ' +
      (on ? "on" : "off") +
      '">' +
      d.label +
      "</button>"
    );
  }).join("");
}

/** Live OCR-review dest pills (BOOKS-S1-001 / AUTO PARTS SUPPLY CO., 2026-09-14). */
var LIVE_OCR_REVIEW_DEST_LABELS = ["Parts shelf", "A stock number", "Krown supplies", "Overhead"];

/**
 * Post-OCR Vendor bill dest row. This is the full-PASS gap: live Jt has no
 * Work Order. Same BILL_DESTS as the rest of the form — photo/OCR is not a
 * second picker.
 */
function ocrReviewScreen(scan) {
  var apply = (scan && scan.apply) || "wo";
  var dest = BILL_DESTS.find(function (d) {
    return d.id === apply;
  }) || BILL_DESTS[0];
  return {
    vendor: (scan && scan.vendor) || "",
    invoiceNo: (scan && scan.invoiceNo) || "",
    invoiceDate: (scan && scan.invoiceDate) || "",
    gl: BILL_GL[apply],
    dests: BILL_DESTS,
    destLabels: destLabels(BILL_DESTS),
    apply: apply,
    hint: dest.hint,
    woPicker: apply === "wo",
    net: scan && scan.net,
    tax: scan && scan.tax,
    total: round2(Number((scan && scan.net) || 0) + Number((scan && scan.tax) || 0)),
    postLabel: "Post bill",
  };
}

module.exports = {
  BILL_DESTS: BILL_DESTS,
  BILL_GL: BILL_GL,
  LIVE_BILL_DESTS: LIVE_BILL_DESTS,
  LIVE_OCR_REVIEW_DEST_LABELS: LIVE_OCR_REVIEW_DEST_LABELS,
  LIVE_POST_BILL_GATES_DESTS_ON_PHOTO: LIVE_POST_BILL_GATES_DESTS_ON_PHOTO,
  RECEIVE_DESTS: RECEIVE_DESTS,
  applyFromScanText: applyFromScanText,
  destDesk: destDesk,
  destLabels: destLabels,
  findWorkOrder: findWorkOrder,
  hasWorkOrderDest: hasWorkOrderDest,
  journalFromVendorBill: journalFromVendorBill,
  livePostBillScreen: livePostBillScreen,
  ocrReviewScreen: ocrReviewScreen,
  postBillScreen: postBillScreen,
  postVendorBill: postVendorBill,
  renderDestChipsHtml: renderDestChipsHtml,
  setPartDestination: setPartDestination,
  validateVendorBill: validateVendorBill,
  woCostLine: woCostLine,
};

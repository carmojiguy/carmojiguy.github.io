"use strict";

/**
 * BOOKS-BILL-SKU-001 — Parts stock search index
 *
 * Live OS (birch-lake-zinc-dawn.grok.me) store.setPartDestination currently:
 *
 *   parts: dest.kind !== "work_order"
 *       && dest.kind !== "department"
 *       && dest.kind !== "stock_number"
 *     ? [row, ...state.parts]
 *     : state.parts
 *
 * That drops billed SKUs from the Parts → stock table when the destination
 * is a WO. CFO SUPERSEDE 2026-09-14: the SKU row MUST appear after WO
 * allocate. Qty 0 on the shelf is OK. WO-bound is not an excuse for a
 * missing row. "WO-only receive → no stock row" was retracted.
 *
 * HOLD: do not post extra BOOKS-004 journals from this helper. Journal
 * posting stays on the existing bt() / parts-in path.
 */

function money(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function sellFromCost(cost) {
  return money(Number(cost || 0) * 1.67);
}

function skuKey(sku) {
  return String(sku || "").trim();
}

function findPartIndex(parts, sku) {
  const key = skuKey(sku);
  if (!key) return -1;
  return (parts || []).findIndex(function (p) {
    return skuKey(p && p.sku) === key;
  });
}

/** Destinations that consume the receive off the shelf (on-hand stays 0 / unchanged). */
function isOffShelfDestination(kind) {
  return kind === "work_order" || kind === "department" || kind === "stock_number";
}

function catalogRowFromIntake(intake, qtyOnShelf, now) {
  const cost = money(intake.cost || 0);
  return {
    id: intake.partId || ("p-" + skuKey(intake.sku).toLowerCase()),
    sku: skuKey(intake.sku),
    desc: intake.desc || "",
    qty: Number(qtyOnShelf) || 0,
    min: intake.min != null ? intake.min : 1,
    cost: cost,
    sell: intake.sell != null ? money(intake.sell) : sellFromCost(cost),
    list: intake.list,
    supplier: intake.supplier || intake.vendorName || "",
    bin: intake.bin || "",
    lastReceived: now || new Date().toISOString(),
  };
}

/**
 * Keep a single searchable catalog row per SKU.
 * Off-shelf receives (WO / department / VIN) never hide the row and never
 * inflate on-hand — they upsert qty 0 when the SKU is new, or leave existing qty.
 */
function upsertStockRow(parts, row, opts) {
  const list = Array.isArray(parts) ? parts.slice() : [];
  const incoming = Object.assign({}, row, { sku: skuKey(row && row.sku) });
  if (!incoming.sku) return list;
  const idx = findPartIndex(list, incoming.sku);
  const offShelf = !!(opts && opts.offShelf);
  if (idx < 0) {
    list.unshift(incoming);
    return list;
  }
  const cur = list[idx];
  list[idx] = Object.assign({}, cur, {
    desc: cur.desc || incoming.desc,
    cost: incoming.cost != null ? incoming.cost : cur.cost,
    sell: cur.sell || incoming.sell,
    supplier: cur.supplier || incoming.supplier,
    lastReceived: incoming.lastReceived || cur.lastReceived,
    qty: offShelf ? Number(cur.qty) || 0 : incoming.qty,
  });
  return list;
}

/**
 * Replacement for the live `parts:` assignment inside setPartDestination.
 * Always indexes the billed SKU. Shelf dest adds on-hand; WO dest qty 0 is OK.
 */
function partsAfterDestination(parts, intake, destKind, now) {
  const offShelf = isOffShelfDestination(destKind);
  const existing = (parts || []).find(function (p) {
    return skuKey(p && p.sku) === skuKey(intake.sku);
  });
  const qtyOnShelf = offShelf ? (existing ? Number(existing.qty) || 0 : 0) : Number(intake.qty) || 0;
  const row = catalogRowFromIntake(intake, qtyOnShelf, now);
  return upsertStockRow(parts, row, { offShelf: offShelf });
}

function billedSkusFromJournals(journals) {
  const out = [];
  const seen = Object.create(null);
  (journals || []).forEach(function (j) {
    const src = String((j && j.source) || "");
    if (src.indexOf("parts:") !== 0) return;
    const sku = skuKey(src.slice("parts:".length));
    if (!sku || seen[sku]) return;
    seen[sku] = true;
    out.push({
      sku: sku,
      desc: (j.memo && String(j.memo).replace(/^Parts in\s+/i, "").split(" · ")[0]) || sku,
      cost: 0,
    });
  });
  return out;
}

function skuHintsFromWorkOrders(workOrders) {
  const map = Object.create(null);
  (workOrders || []).forEach(function (wo) {
    (wo.parts || []).forEach(function (line) {
      const sku = skuKey(line && line.sku);
      if (!sku || map[sku]) return;
      map[sku] = {
        sku: sku,
        desc: line.desc || "",
        cost: line.cost,
        sell: line.sell,
        supplier: line.supplier,
      };
    });
  });
  return map;
}

/**
 * Hydrate/repair: any SKU that already posted a parts-in journal must have a
 * stock row, including NAPA-ROT-992 after a persisted SORT-WO allocate.
 * Does not invent journals. Does not touch WO UI lines.
 */
function backfillBilledStockRows(parts, journals, workOrders) {
  const hints = skuHintsFromWorkOrders(workOrders);
  let next = Array.isArray(parts) ? parts.slice() : [];
  billedSkusFromJournals(journals).forEach(function (billed) {
    if (findPartIndex(next, billed.sku) >= 0) return;
    const hint = hints[billed.sku] || {};
    next = upsertStockRow(next, catalogRowFromIntake({
      sku: billed.sku,
      desc: hint.desc || billed.desc,
      cost: hint.cost || billed.cost,
      sell: hint.sell,
      supplier: hint.supplier,
      min: 1,
    }, 0), { offShelf: true });
  });
  return next;
}

/** Same match as Parts → stock search: SKU, description, bin. */
function searchStock(parts, query) {
  const q = String(query || "").trim().toLowerCase();
  return (parts || []).filter(function (row) {
    if (!q) return true;
    return (
      String(row.sku || "").toLowerCase().indexOf(q) >= 0 ||
      String(row.desc || "").toLowerCase().indexOf(q) >= 0 ||
      String(row.bin || "").toLowerCase().indexOf(q) >= 0
    );
  });
}

module.exports = {
  billedSkusFromJournals,
  backfillBilledStockRows,
  catalogRowFromIntake,
  findPartIndex,
  isOffShelfDestination,
  partsAfterDestination,
  searchStock,
  sellFromCost,
  upsertStockRow,
};

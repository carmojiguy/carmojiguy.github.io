"use strict";

/**
 * BOOKS-BANK-001 — Close the day / Statement pack unmatched-bank gate
 *
 * Live OS (birch-lake-zinc-dawn.grok.me, store-DOO4oKbP.js + accounting-CymDpuHW.js):
 *
 *   Ct(journals, vehicles) → booksOk
 *     booksOk = inventoryOk && floorOk && unitDrift.length === 0
 *     blockReason = VIN On 1100 / Floor liens only
 *   Close the day: disabled={!q.booksOk}; onClick → toast "Day closed"
 *   Statement pack: same booksOk; banner "Statement pack blocked. " + blockReason
 *
 *   Flow → Cash → Bank rec badge:
 *     bank.filter(tx => tx.status === "unmatched").length   // ALL dates
 *
 *   Bank → Reconcile unmatched:
 *     bank.filter(tx => tx.status === "unmatched" && inRange(date))
 *
 * FAIL: Stock VIN tied → Close toasted "Day closed" while Flow still showed
 * "1 unmatched". Bank on Today showed unmatched 0 because the remaining
 * unmatched line sat outside the date range (META ADS 2026-08-30 vs Today
 * 2026-09-01). Close never read bank status at all.
 *
 * Authoritative unmatched count = Flow's count (every unmatched bank line,
 * no date filter). Close / Statement / Flow badge / Reconcile "rec is done"
 * must share that source so Close cannot succeed while Flow shows unmatched>0.
 *
 * CFO split from BOOKS-FLOOR-TIE-001: bank unmatched gates even when VIN /
 * floor / liens also fail. Do not swallow the unmatched-bank reason.
 *
 * HOLD: Deliver / BOOKS-004, Appraisal Center #73, OpenLane solds.
 */

function isUnmatchedBank(tx) {
  return !!(tx && tx.status === "unmatched");
}

/** Flow Bank rec `open` / Close / Statement — never date-filter this. */
function unmatchedBankLines(bank) {
  return (bank || []).filter(isUnmatchedBank);
}

function unmatchedBankCount(bank) {
  return unmatchedBankLines(bank).length;
}

/** Bank view list helper only. Close must not use this. */
function unmatchedBankInRange(bank, start, end) {
  return (bank || []).filter(function (tx) {
    if (!isUnmatchedBank(tx)) return false;
    if (start == null && end == null) return true;
    return inDateRange(tx.date, start, end);
  });
}

function inDateRange(date, start, end) {
  var d = String(date || "").slice(0, 10);
  if (!d) return false;
  if (start && d < String(start).slice(0, 10)) return false;
  if (end && d > String(end).slice(0, 10)) return false;
  return true;
}

function unmatchedBankReason(count) {
  var n = Number(count) || 0;
  if (n <= 0) return "";
  if (n === 1) return "1 unmatched bank line";
  return n + " unmatched bank lines";
}

function flowBankRec(bank) {
  var open = unmatchedBankCount(bank);
  return {
    id: "bank",
    label: "Bank rec",
    open: open,
    hint: open ? open + " unmatched" : "Tied",
  };
}

function joinReasons(parts) {
  return (parts || []).filter(Boolean).join(" · ");
}

/**
 * Overlay the unmatched-bank gate on the VIN/floor result from Ct().
 * Does not change VIN math (BOOKS-FLOOR-TIE-001 stays a separate ticket).
 */
function withBankCloseGate(vin, bank) {
  var src = vin || {};
  var unmatched = unmatchedBankCount(bank);
  var bankOk = unmatched === 0;
  var vinOk = src.vinOk;
  if (vinOk == null) vinOk = src.booksOk !== false;

  var vinReason = vinOk ? "" : String(src.blockReason || "").trim();
  var bankReason = unmatchedBankReason(unmatched);
  var blockReason = joinReasons([vinReason, bankReason]);
  var booksOk = vinOk && bankOk;

  return Object.assign({}, src, {
    unmatchedBank: unmatched,
    bankOk: bankOk,
    vinOk: vinOk,
    booksOk: booksOk,
    blockReason: booksOk ? "" : blockReason,
    closeDisabled: !booksOk,
    statementLocked: !booksOk,
    statementBanner: booksOk ? null : "Statement pack blocked. " + blockReason,
  });
}

function closeBlockedBanner(gate) {
  if (!gate || gate.booksOk) return null;
  if (gate.vinOk) {
    return {
      title: "Day closed and statement pack are blocked.",
      reason: gate.blockReason,
    };
  }
  return {
    title: "VIN schedule does not tie. Day closed and statement pack are blocked.",
    reason: gate.blockReason,
  };
}

/**
 * Close the day. Refuses when booksOk is false. When unmatched>0 the
 * reason always includes unmatched-bank text, even if VIN/floor also fail.
 */
function refuseReason(gate) {
  var unmatched = gate && typeof gate.unmatchedBank === "number" ? gate.unmatchedBank : 0;
  var bankReason = unmatchedBankReason(unmatched);
  var existing = gate && gate.blockReason ? String(gate.blockReason).trim() : "";
  if (existing && /unmatched bank/.test(existing)) return existing;
  return joinReasons([existing, bankReason]);
}

function closeAllowed(gate) {
  if (!gate || !gate.booksOk) return false;
  if ((gate.unmatchedBank || 0) > 0) return false;
  return true;
}

function closeTheDay(gate) {
  if (closeAllowed(gate)) {
    return {
      ok: true,
      closed: true,
      blocked: false,
      toast: "Day closed",
      reason: "",
    };
  }
  var reason = refuseReason(gate);
  return {
    ok: false,
    closed: false,
    blocked: true,
    toast: null,
    reason: reason,
  };
}

function openStatementPack(gate) {
  if (closeAllowed(gate)) {
    return {
      ok: true,
      blocked: false,
      locked: false,
      reason: "",
      banner: null,
    };
  }
  var reason = refuseReason(gate);
  return {
    ok: false,
    blocked: true,
    locked: true,
    reason: reason,
    banner: "Statement pack blocked. " + reason,
  };
}

function vinTied(extras) {
  return Object.assign(
    {
      booksOk: true,
      vinOk: true,
      inventoryOk: true,
      floorOk: true,
      unitDrift: [],
      blockReason: "",
      gl1100: 1685305,
      glFloor: 749340,
      gl2010: 508154,
      liens: 749340,
      sumOn: 1685305,
    },
    extras || {},
  );
}

function vinUntied(extras) {
  return Object.assign(
    {
      booksOk: false,
      vinOk: false,
      inventoryOk: true,
      floorOk: false,
      unitDrift: [],
      blockReason: "Floor liens 100 ≠ floor GL 80",
    },
    extras || {},
  );
}

module.exports = {
  isUnmatchedBank: isUnmatchedBank,
  unmatchedBankLines: unmatchedBankLines,
  unmatchedBankCount: unmatchedBankCount,
  unmatchedBankInRange: unmatchedBankInRange,
  unmatchedBankReason: unmatchedBankReason,
  flowBankRec: flowBankRec,
  withBankCloseGate: withBankCloseGate,
  closeBlockedBanner: closeBlockedBanner,
  closeAllowed: closeAllowed,
  closeTheDay: closeTheDay,
  openStatementPack: openStatementPack,
  vinTied: vinTied,
  vinUntied: vinUntied,
  inDateRange: inDateRange,
};

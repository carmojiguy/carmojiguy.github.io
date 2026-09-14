"use strict";

/**
 * BOOKS-BANK-001 + BOOKS-BANK-BADGE-001
 *
 * Live OS (birch-lake-zinc-dawn.grok.me, store-DOO4oKbP.js + accounting-CymDpuHW.js):
 *
 *   Ct(journals, vehicles) → booksOk  (VIN / floor / liens only — no bank)
 *   Close the day: toast "Day closed"  (not a period lock — BOOKS-006 later)
 *
 *   Bank → Reconcile unmatched (authoritative):
 *     bank.filter(tx => tx.status === "unmatched" && inRange(tx.date, start, end))
 *
 *   Flow → Cash → Bank rec badge (BUG):
 *     bank.filter(tx => tx.status === "unmatched").length   // ALL dates
 *
 * Breaker: Bank Today unmatched 0, Flow badge 1 (META ADS 2026-08-30 sits
 * outside Today). CFO 2026-09-14: do NOT gate Close on that Flow 1.
 * Authoritative count is the live Bank unmatched count. Badge ≡ Bank.
 *
 * If Bank unmatched > 0: hard-block Close + Statement with
 * "Clear unmatched bank lines before close".
 *
 * FLOOR-TIE stays separate (this run floor = liens). Bank reason still
 * appends when floor also fails.
 *
 * HOLD: Deliver / BOOKS-004, Appraisal Center #73, OpenLane solds.
 */

var BANK_CLOSE_BLOCK = "Clear unmatched bank lines before close";

function isUnmatchedBank(tx) {
  return !!(tx && tx.status === "unmatched");
}

function inDateRange(date, start, end) {
  var d = String(date || "").slice(0, 10);
  if (!d) return false;
  if (start && d < String(start).slice(0, 10)) return false;
  if (end && d > String(end).slice(0, 10)) return false;
  return true;
}

function rangeOf(range) {
  if (!range) return { start: undefined, end: undefined };
  return { start: range.start, end: range.end };
}

/** Live Bank unmatched lines — same filter as Bank → Reconcile `K`. */
function bankUnmatchedLines(bank, range) {
  var r = rangeOf(range);
  return (bank || []).filter(function (tx) {
    if (!isUnmatchedBank(tx)) return false;
    if (r.start == null && r.end == null) return true;
    return inDateRange(tx.date, r.start, r.end);
  });
}

function bankUnmatchedCount(bank, range) {
  return bankUnmatchedLines(bank, range).length;
}

/** Old Flow formula. Do not use for Close or the badge. */
function allDatesUnmatchedCount(bank) {
  return (bank || []).filter(isUnmatchedBank).length;
}

function unmatchedBankReason(count) {
  return (Number(count) || 0) > 0 ? BANK_CLOSE_BLOCK : "";
}

/** Flow Bank rec badge — MUST equal bankUnmatchedCount (badge ≡ Bank). */
function flowBankRec(bank, range) {
  var open = bankUnmatchedCount(bank, range);
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
 * Overlay the Bank unmatched gate on VIN/floor Ct().
 * range is the live Bank date range (Today bar). Do not omit it or Close
 * will count all-dates unmatched the way the Flow badge used to.
 */
function withBankCloseGate(vin, bank, range) {
  var src = vin || {};
  var unmatched = bankUnmatchedCount(bank, range);
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
    range: range || null,
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

function refuseReason(gate) {
  var unmatched = gate && typeof gate.unmatchedBank === "number" ? gate.unmatchedBank : 0;
  var bankReason = unmatchedBankReason(unmatched);
  var existing = gate && gate.blockReason ? String(gate.blockReason).trim() : "";
  if (existing && existing.indexOf(BANK_CLOSE_BLOCK) >= 0) return existing;
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
      periodLocked: false,
    };
  }
  var reason = refuseReason(gate);
  return {
    ok: false,
    closed: false,
    blocked: true,
    toast: null,
    reason: reason,
    periodLocked: false,
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
  BANK_CLOSE_BLOCK: BANK_CLOSE_BLOCK,
  isUnmatchedBank: isUnmatchedBank,
  inDateRange: inDateRange,
  bankUnmatchedLines: bankUnmatchedLines,
  bankUnmatchedCount: bankUnmatchedCount,
  unmatchedBankCount: bankUnmatchedCount,
  allDatesUnmatchedCount: allDatesUnmatchedCount,
  unmatchedBankInRange: bankUnmatchedLines,
  unmatchedBankReason: unmatchedBankReason,
  flowBankRec: flowBankRec,
  withBankCloseGate: withBankCloseGate,
  closeBlockedBanner: closeBlockedBanner,
  closeAllowed: closeAllowed,
  closeTheDay: closeTheDay,
  openStatementPack: openStatementPack,
  vinTied: vinTied,
  vinUntied: vinUntied,
};

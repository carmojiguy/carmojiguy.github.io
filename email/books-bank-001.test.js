#!/usr/bin/env node
"use strict";

/**
 * BOOKS-BANK-001 + BOOKS-BANK-BADGE-001
 *
 * CFO 2026-09-14: Close / Statement read the live Bank unmatched count.
 * Flow Bank rec badge ≡ that same Bank count. Do not gate Close on the
 * all-dates Flow 1 when Bank Today says 0.
 */

const assert = require("assert");
const path = require("path");
const Gate = require(path.join(__dirname, "..", "books", "close-bank-gate.js"));

const TODAY = "2026-09-01";
const RANGE = { start: TODAY, end: TODAY };

const MATCHED_TODAY = {
  id: "bx-1",
  date: TODAY,
  amount: -84.22,
  description: "COSTCO GAS #1241 MISSISSAUGA",
  status: "matched",
  matchedDept: "overhead",
};

const MATCHED_BELL = {
  id: "bx-2",
  date: TODAY,
  amount: -312.18,
  description: "BELL CANADA AUTOPAY",
  status: "matched",
  matchedDept: "overhead",
};

const UNMATCHED_META = {
  id: "bx-5",
  date: "2026-08-30",
  amount: -680,
  description: "META ADS GNM AUTO",
  status: "unmatched",
  suggested: "sales",
};

const UNMATCHED_TODAY = {
  id: "bx-x",
  date: TODAY,
  amount: -99.0,
  description: "UNKNOWN WIRE",
  status: "unmatched",
};

const IGNORED = {
  id: "bx-ign",
  date: "2026-08-29",
  amount: -12,
  description: "IGNORED FEE",
  status: "ignored",
};

function liveBank() {
  return [MATCHED_TODAY, MATCHED_BELL, UNMATCHED_META, IGNORED];
}

function badgeEqualsBank(bank, range) {
  assert.equal(
    Gate.flowBankRec(bank, range).open,
    Gate.bankUnmatchedCount(bank, range),
    "Flow Bank rec badge ≡ live Bank unmatched count",
  );
}

// --- BOOKS-BANK-BADGE-001: badge follows Bank, not all-dates ---

assert.equal(Gate.allDatesUnmatchedCount(liveBank()), 1, "old Flow formula still sees META ADS");
assert.equal(Gate.bankUnmatchedCount(liveBank(), RANGE), 0, "live Bank Today unmatched is 0");
assert.equal(Gate.flowBankRec(liveBank(), RANGE).open, 0);
assert.equal(Gate.flowBankRec(liveBank(), RANGE).hint, "Tied");
badgeEqualsBank(liveBank(), RANGE);

assert.equal(Gate.unmatchedBankReason(1), Gate.BANK_CLOSE_BLOCK);
assert.equal(Gate.unmatchedBankReason(0), "");
assert.equal(Gate.bankUnmatchedCount([]), 0);
assert.equal(Gate.bankUnmatchedCount([{ status: "matched" }, { status: "ignored" }], RANGE), 0);

// --- Close must NOT use the Flow-all-dates 1 when Bank says 0 ---

const liveVin = Gate.vinTied();
assert.equal(liveVin.booksOk, true, "pre-fix VIN-only booksOk is true");
assert.equal(liveVin.glFloor, liveVin.liens, "this run floor = liens (not FLOOR-TIE)");

const liveGate = Gate.withBankCloseGate(liveVin, liveBank(), RANGE);
assert.equal(liveGate.vinOk, true);
assert.equal(liveGate.unmatchedBank, 0, "gate reads Bank Today, not Flow all-dates");
assert.equal(liveGate.bankOk, true);
assert.equal(liveGate.booksOk, true, "Bank unmatched 0 → do not block Close on Flow's 1");
assert.equal(liveGate.closeDisabled, false);
assert.equal(liveGate.blockReason, "");
assert.equal(Gate.closeTheDay(liveGate).ok, true);
assert.equal(Gate.closeTheDay(liveGate).toast, "Day closed");
assert.equal(Gate.closeTheDay(liveGate).periodLocked, false, "toast is not a period lock (BOOKS-006)");
assert.equal(Gate.openStatementPack(liveGate).ok, true);

// --- BOOKS-BANK-001: Bank unmatched > 0 hard-blocks Close + Statement ---

const openBank = [MATCHED_TODAY, MATCHED_BELL, UNMATCHED_TODAY, UNMATCHED_META];
assert.equal(Gate.bankUnmatchedCount(openBank, RANGE), 1);
assert.equal(Gate.allDatesUnmatchedCount(openBank), 2);
badgeEqualsBank(openBank, RANGE);
assert.equal(Gate.flowBankRec(openBank, RANGE).hint, "1 unmatched");

const openGate = Gate.withBankCloseGate(Gate.vinTied(), openBank, RANGE);
assert.equal(openGate.vinOk, true, "VIN/floor stay tied — FLOOR-TIE is separate");
assert.equal(openGate.bankOk, false);
assert.equal(openGate.unmatchedBank, 1);
assert.equal(openGate.booksOk, false);
assert.equal(openGate.closeDisabled, true);
assert.equal(openGate.statementLocked, true);
assert.equal(openGate.blockReason, Gate.BANK_CLOSE_BLOCK);
assert.equal(openGate.statementBanner, "Statement pack blocked. " + Gate.BANK_CLOSE_BLOCK);

const spoof = Object.assign({}, openGate, { booksOk: true, closeDisabled: false });
assert.equal(Gate.closeTheDay(spoof).ok, false, "unmatched>0 refuses even if booksOk was left true");
assert.equal(Gate.closeTheDay(spoof).reason, Gate.BANK_CLOSE_BLOCK);
assert.equal(Gate.closeTheDay(spoof).toast, null);
assert.equal(Gate.closeTheDay(spoof).periodLocked, false);
assert.equal(Gate.openStatementPack(spoof).ok, false);

const closed = Gate.closeTheDay(openGate);
assert.equal(closed.ok, false);
assert.equal(closed.closed, false);
assert.equal(closed.blocked, true);
assert.equal(closed.toast, null, "must not toast Day closed while Bank unmatched > 0");
assert.equal(closed.reason, Gate.BANK_CLOSE_BLOCK);

const pack = Gate.openStatementPack(openGate);
assert.equal(pack.ok, false);
assert.equal(pack.locked, true);
assert.equal(pack.banner, "Statement pack blocked. " + Gate.BANK_CLOSE_BLOCK);

const banner = Gate.closeBlockedBanner(openGate);
assert.ok(banner);
assert.equal(banner.title, "Day closed and statement pack are blocked.");
assert.equal(banner.reason, Gate.BANK_CLOSE_BLOCK);
assert.ok(!/VIN schedule does not tie/.test(banner.title));

// --- CFO split: bank sentence still fires when floor/liens also fail ---

const both = Gate.withBankCloseGate(Gate.vinUntied(), openBank, RANGE);
assert.equal(both.vinOk, false);
assert.equal(both.bankOk, false);
assert.equal(both.booksOk, false);
assert.match(both.blockReason, /Floor liens/);
assert.ok(both.blockReason.indexOf(Gate.BANK_CLOSE_BLOCK) >= 0);
assert.equal(Gate.closeTheDay(both).ok, false);
assert.ok(Gate.closeTheDay(both).reason.indexOf(Gate.BANK_CLOSE_BLOCK) >= 0);
assert.ok(Gate.openStatementPack(both).banner.indexOf(Gate.BANK_CLOSE_BLOCK) >= 0);
const bothBanner = Gate.closeBlockedBanner(both);
assert.match(bothBanner.title, /VIN schedule does not tie/);
assert.ok(bothBanner.reason.indexOf(Gate.BANK_CLOSE_BLOCK) >= 0);

const floorOnly = Gate.withBankCloseGate(Gate.vinUntied(), liveBank(), RANGE);
assert.equal(floorOnly.unmatchedBank, 0);
assert.equal(floorOnly.bankOk, true);
assert.equal(floorOnly.booksOk, false);
assert.ok(floorOnly.blockReason.indexOf(Gate.BANK_CLOSE_BLOCK) < 0);
assert.equal(Gate.closeTheDay(floorOnly).ok, false);

const many = Gate.withBankCloseGate(Gate.vinTied(), [UNMATCHED_TODAY, { id: "bx-y", date: TODAY, status: "unmatched" }], RANGE);
assert.equal(many.unmatchedBank, 2);
assert.equal(many.blockReason, Gate.BANK_CLOSE_BLOCK);
assert.equal(Gate.flowBankRec([UNMATCHED_TODAY, { id: "bx-y", date: TODAY, status: "unmatched" }], RANGE).open, 2);
badgeEqualsBank([UNMATCHED_TODAY, { id: "bx-y", date: TODAY, status: "unmatched" }], RANGE);

console.log("BOOKS-BANK-001 ok");

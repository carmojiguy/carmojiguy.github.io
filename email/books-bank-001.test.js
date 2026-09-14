#!/usr/bin/env node
"use strict";

/**
 * BOOKS-BANK-001 regression
 *
 * Live fail: Stock → Close the day toasted "Day closed" with no unmatched-bank
 * gate. Flow → Cash → Bank rec still showed badge "1" / "1 unmatched".
 * Bank on Today showed unmatched 0 because the open line sat outside the
 * date range. Statement pack used the same VIN-only booksOk.
 */

const assert = require("assert");
const path = require("path");
const Gate = require(path.join(__dirname, "..", "books", "close-bank-gate.js"));

const TODAY = "2026-09-01";

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

// --- count source: Flow (all dates) vs Bank view (Today) ---

assert.equal(Gate.unmatchedBankCount(liveBank()), 1, "Flow count is every unmatched line");
assert.equal(
  Gate.unmatchedBankInRange(liveBank(), TODAY, TODAY).length,
  0,
  "Bank view on Today can read unmatched 0 while Flow still shows 1",
);
assert.equal(Gate.flowBankRec(liveBank()).open, 1);
assert.equal(Gate.flowBankRec(liveBank()).hint, "1 unmatched");
assert.equal(Gate.unmatchedBankReason(1), "1 unmatched bank line");
assert.equal(Gate.unmatchedBankReason(2), "2 unmatched bank lines");
assert.equal(Gate.unmatchedBankReason(0), "");
assert.equal(Gate.unmatchedBankCount([]), 0);
assert.equal(Gate.unmatchedBankCount([{ status: "matched" }, { status: "ignored" }]), 0);

// --- live fail: VIN ties, Today unmatched 0, Flow unmatched 1 ---

const liveVin = Gate.vinTied();
assert.equal(liveVin.booksOk, true, "pre-fix VIN-only booksOk is true (the live hole)");

const liveGate = Gate.withBankCloseGate(liveVin, liveBank());
assert.equal(liveGate.vinOk, true, "VIN/floor stay tied — FLOOR-TIE is a separate ticket");
assert.equal(liveGate.bankOk, false);
assert.equal(liveGate.unmatchedBank, 1);
assert.equal(liveGate.booksOk, false, "Close cannot succeed while Flow shows unmatched>0");
assert.equal(liveGate.closeDisabled, true);
assert.equal(liveGate.statementLocked, true);
assert.match(liveGate.blockReason, /unmatched bank/);
assert.equal(liveGate.blockReason, "1 unmatched bank line");
assert.equal(liveGate.statementBanner, "Statement pack blocked. 1 unmatched bank line");

// Defense: Close still refuses unmatched>0 if booksOk was left true (not a UI-only disable).
const spoof = Object.assign({}, liveGate, { booksOk: true, closeDisabled: false });
assert.equal(Gate.closeTheDay(spoof).ok, false, "unmatched>0 refuses even if booksOk was left true");
assert.match(Gate.closeTheDay(spoof).reason, /unmatched bank/);
assert.equal(Gate.openStatementPack(spoof).ok, false);

const closed = Gate.closeTheDay(liveGate);
assert.equal(closed.ok, false);
assert.equal(closed.closed, false);
assert.equal(closed.blocked, true);
assert.equal(closed.toast, null, "must not toast Day closed");
assert.match(closed.reason, /unmatched bank/);

const pack = Gate.openStatementPack(liveGate);
assert.equal(pack.ok, false);
assert.equal(pack.locked, true);
assert.match(pack.banner, /Statement pack blocked/);
assert.match(pack.banner, /unmatched bank/);

const banner = Gate.closeBlockedBanner(liveGate);
assert.ok(banner);
assert.equal(banner.title, "Day closed and statement pack are blocked.");
assert.match(banner.reason, /unmatched bank/);
assert.ok(!/VIN schedule does not tie/.test(banner.title), "do not blame VIN when VIN ties");

// Bank Reconcile header must use the Flow count, not Today-filtered 0
assert.equal(Gate.unmatchedBankCount(liveBank()), Gate.flowBankRec(liveBank()).open);

// --- clean bank: Close allowed ---

const cleanBank = [MATCHED_TODAY, MATCHED_BELL, IGNORED];
const cleanGate = Gate.withBankCloseGate(Gate.vinTied(), cleanBank);
assert.equal(cleanGate.booksOk, true);
assert.equal(cleanGate.unmatchedBank, 0);
assert.equal(cleanGate.blockReason, "");
assert.equal(Gate.flowBankRec(cleanBank).hint, "Tied");
const okClose = Gate.closeTheDay(cleanGate);
assert.equal(okClose.ok, true);
assert.equal(okClose.toast, "Day closed");
assert.equal(Gate.openStatementPack(cleanGate).ok, true);
assert.equal(Gate.openStatementPack(cleanGate).banner, null);
assert.equal(Gate.closeBlockedBanner(cleanGate), null);

// --- CFO split: unmatched still named when floor/liens also fail ---

const both = Gate.withBankCloseGate(Gate.vinUntied(), liveBank());
assert.equal(both.vinOk, false);
assert.equal(both.bankOk, false);
assert.equal(both.booksOk, false);
assert.match(both.blockReason, /Floor liens/);
assert.match(both.blockReason, /unmatched bank/);
assert.ok(
  both.blockReason.indexOf("Floor liens") < both.blockReason.indexOf("unmatched bank"),
  "VIN/floor reason stays; unmatched-bank is appended, not swallowed",
);
const bothClose = Gate.closeTheDay(both);
assert.equal(bothClose.ok, false);
assert.match(bothClose.reason, /unmatched bank/);
assert.match(Gate.openStatementPack(both).banner, /unmatched bank/);
const bothBanner = Gate.closeBlockedBanner(both);
assert.match(bothBanner.title, /VIN schedule does not tie/);
assert.match(bothBanner.reason, /unmatched bank/);

// floor-only fail must not invent a bank reason
const floorOnly = Gate.withBankCloseGate(Gate.vinUntied(), cleanBank);
assert.equal(floorOnly.unmatchedBank, 0);
assert.equal(floorOnly.bankOk, true);
assert.equal(floorOnly.booksOk, false);
assert.ok(!/unmatched bank/.test(floorOnly.blockReason));
assert.equal(Gate.closeTheDay(floorOnly).ok, false);

// several unmatched lines
const many = Gate.withBankCloseGate(Gate.vinTied(), [
  UNMATCHED_META,
  { id: "bx-x", date: TODAY, status: "unmatched", description: "UNKNOWN WIRE" },
]);
assert.equal(many.unmatchedBank, 2);
assert.equal(many.blockReason, "2 unmatched bank lines");
assert.equal(Gate.closeTheDay(many).ok, false);
assert.equal(Gate.flowBankRec([UNMATCHED_META, { id: "bx-x", date: TODAY, status: "unmatched" }]).open, 2);

console.log("BOOKS-BANK-001 ok");

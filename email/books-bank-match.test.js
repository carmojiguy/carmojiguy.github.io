#!/usr/bin/env node
"use strict";

const assert = require("assert");
const path = require("path");
const Bank = require(path.join(__dirname, "..", "books", "bank-match.js"));

const COSTCO = "COSTCO GAS #1241 MISSISSAUGA";
const WHOLESALE = "COSTCO WHOLESALE W0118 LEVIS";

function mustFuelJournal(j, msg) {
  assert.equal(Bank.expenseAccountFromJournal(j), Bank.FUEL_GL, msg + " GL 5330");
  assert.equal(Bank.expenseDeptFromJournal(j), "fuel", msg + " dept fuel");
  assert.ok(
    !j.lines.some(function (l) {
      return l.account === Bank.OVERHEAD_GL && l.debit > 0;
    }),
    msg + " must not debit Overhead 5300",
  );
}

const seed = Bank.applyMerchantSuggestion({
  id: "bx-1",
  date: "2026-09-01",
  amount: -84.22,
  description: COSTCO,
  status: "unmatched",
  suggested: "overhead",
  suggestedWhy: Bank.COSTCO_GAS_WHY,
});
assert.equal(seed.suggested, "fuel", "seed Costco Gas suggests Fuel, not Overhead");
assert.equal(seed.suggestedWhy, Bank.COSTCO_GAS_WHY, "keep the Fuel helper text");
assert.equal(Bank.SEED_COSTCO_GAS.suggested, "fuel", "canonical seed is Fuel");

assert.equal(Bank.isFuelMerchant(COSTCO), true, "Costco Gas is a fuel merchant");
assert.equal(Bank.isFuelMerchant("COSTCO GAS #1241 MISSISSAUGA"), true);
assert.equal(Bank.isFuelMerchant(WHOLESALE), false, "Costco Wholesale is not Fuel");
assert.equal(Bank.isFuelMerchant("NAPA AUTOPRO ROCKLAND"), false);
assert.equal(Bank.isFuelMerchant("PETROCAN ROCKLAND"), true);
assert.equal(Bank.isFuelMerchant("PETRO-CANADA 00558 NEPEAN"), true);
assert.equal(Bank.isFuelMerchant("SHELL C04456 OTTAWA"), true);
assert.equal(Bank.isFuelMerchant("ESSO CIRCLE K OTTAWA"), true);
assert.equal(Bank.isFuelMerchant("MOBIL@ 4281 GAS STN OTTAWA"), true);

assert.equal(Bank.accountForBank("fuel", -84.22), "5330");
assert.equal(Bank.accountForBank("overhead", -84.22), "5300");
assert.equal(Bank.accountForBank("parts", -84.22), "1200");
assert.ok(Bank.DEPTS.indexOf("fuel") >= 0, "Fuel is a match department");
assert.equal(Bank.DEPT_LABEL.fuel, "Fuel");

const poisoned = [
  { id: "br-costco", contains: "costco", account: "5300", department: "overhead", hst: "included" },
  { id: "br-costco-gas-bad", contains: "costco gas", account: "5300", department: "overhead", hst: "included" },
];
const rule = Bank.matchRule(COSTCO, poisoned.concat(Bank.defaultBankRules()));
assert.ok(rule, "Costco Gas matches a rule");
assert.equal(rule.department, "fuel", "merchant Fuel wins over learned Overhead");
assert.equal(rule.account, "5330", "merchant Fuel GL is 5330");

const coding = Bank.resolveBankCoding(COSTCO, poisoned, "overhead", undefined, -84.22);
assert.equal(coding.department, "fuel", "clicking Overhead cannot recode Costco Gas");
assert.equal(coding.account, "5330");

const posted = Bank.postBankMatch(
  { id: "bx-1", date: "2026-09-01", amount: -84.22, description: COSTCO, status: "unmatched" },
  poisoned,
  "overhead",
  undefined,
  "u-christine",
);
assert.ok(posted, "posts");
assert.equal(posted.tx.status, "matched");
assert.equal(posted.tx.matchedDept, "fuel");
assert.equal(Bank.uiMatchLabel(posted.tx), "matched · Fuel", "Bank row reads matched · Fuel");
mustFuelJournal(posted.journal, "Costco Gas post");
assert.equal(posted.rule.department, "fuel", "learned rule stores Fuel");
assert.equal(posted.rule.account, "5330");
assert.equal(posted.rule.contains, "costco gas");

const wholesale = Bank.resolveBankCoding(WHOLESALE, poisoned, "overhead", undefined, -965.61);
assert.equal(wholesale.department, "overhead", "Costco Wholesale can stay Overhead");
assert.notEqual(wholesale.account, "5330", "Wholesale does not hit Fuel GL");

const napa = Bank.matchRule("NAPA AUTOPRO ROCKLAND", Bank.defaultBankRules());
assert.equal(napa.department, "parts");
assert.equal(napa.account, "1200");

const auto = Bank.autoPostBank(
  [
    { id: "bx-1", date: "2026-09-01", amount: -84.22, description: COSTCO, status: "unmatched", suggested: "overhead" },
    { id: "bx-napa", date: "2026-09-02", amount: -1847.22, description: "NAPA AUTOPRO ROCKLAND", status: "unmatched" },
  ],
  [],
  Bank.defaultBankRules(),
  "u-christine",
);
const costcoLine = auto.bank.find(function (t) { return t.id === "bx-1"; });
assert.equal(costcoLine.status, "matched");
assert.equal(costcoLine.matchedDept, "fuel");
assert.equal(Bank.uiMatchLabel(costcoLine), "matched · Fuel");
const costcoJ = auto.journals.find(function (j) { return j.source === "bank:bx-1"; });
mustFuelJournal(costcoJ, "autoPost Costco Gas");
const napaLine = auto.bank.find(function (t) { return t.id === "bx-napa"; });
assert.equal(napaLine.matchedDept, "parts");

const repaired = Bank.repairFuelMatches(
  [
    {
      id: "bx-1",
      date: "2026-09-01",
      amount: -84.22,
      description: COSTCO,
      status: "matched",
      matchedDept: "overhead",
      suggested: "overhead",
      suggestedWhy: Bank.COSTCO_GAS_WHY,
    },
  ],
  [
    {
      id: "j-bank-bx-1",
      source: "bank:bx-1",
      date: "2026-09-01",
      memo: COSTCO,
      createdBy: "u-christine",
      lines: [
        { account: "5300", debit: 74.53, credit: 0, department: "overhead" },
        { account: "1400", debit: 9.69, credit: 0 },
        { account: "1000", debit: 0, credit: 84.22 },
      ],
    },
  ],
  poisoned,
  "u-christine",
);
assert.equal(repaired.bank[0].matchedDept, "fuel");
assert.equal(Bank.uiMatchLabel(repaired.bank[0]), "matched · Fuel");
mustFuelJournal(repaired.journals[0], "repair Costco Gas");
const migrated = repaired.bankRules.find(function (r) { return r.contains === "costco gas"; });
assert.ok(migrated);
assert.equal(migrated.department, "fuel");
assert.equal(migrated.account, "5330");

const csv = Bank.parseBankCsv(Bank.SAMPLE_BANK_CSV);
const petro = csv.find(function (r) { return /PETROCAN/.test(r.description); });
assert.ok(petro);
const petroPost = Bank.autoPostBank(
  [{ id: "bx-petro", date: petro.date, amount: petro.amount, description: petro.description, status: "unmatched" }],
  [],
  Bank.defaultBankRules(),
  "u-christine",
);
assert.equal(petroPost.bank[0].matchedDept, "fuel", "Petrocan is Fuel, not Overhead");
mustFuelJournal(petroPost.journals[0], "Petrocan");

const shellCard = Bank.defaultCardRules().find(function (r) { return r.contains === "shell"; });
assert.equal(shellCard.department, "fuel");
assert.equal(shellCard.account, "5330");
assert.equal(Bank.accountForCard({ rail: "shell", merchant: "Shell", description: "SHELL ROCKLAND" }, "overhead"), "5330");

assert.ok(!Bank.isFuelMerchant("BELL CANADA AUTOPAY"));
assert.equal(Bank.matchRule("BELL CANADA AUTOPAY", Bank.defaultBankRules()).department, "overhead");

console.log("books-bank-match: Costco Gas → Fuel / 5330");

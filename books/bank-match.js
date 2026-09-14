"use strict";

/**
 * G&M Books bank matcher (George Michael / birch-lake-zinc-dawn).
 *
 * Live bug: COSTCO GAS #1241 MISSISSAUGA shows "matched · Overhead" while the
 * helper already says Fuel. Learned Overhead rules and accountForBank() (no
 * fuel → 5330) posted the journal to overhead 5300.
 *
 * Fuel merchant lines (Costco Gas, Petrocan, Shell, Esso, Mobil, gas stn)
 * must: label Fuel, learn Fuel, and debit GL 5330 — not Overhead, not Parts.
 *
 * Drop-in for Grok: src/lib/accounting/bank.ts plus Department "fuel" on
 * types, Bank DEPTS, seed bx-1, and store.matchBank using resolveBankCoding.
 */

var FUEL_GL = "5330";
var OVERHEAD_GL = "5300";
var PARTS_GL = "1200";
var SALES_GL = "5320";
var CASH_GL = "1000";
var AR_GL = "1310";
var ITC_GL = "1400";

var DEPT_LABEL = {
  sales: "Sales",
  service: "Service",
  parts: "Parts",
  crown: "Krown",
  fuel: "Fuel",
  overhead: "Overhead",
};

var DEPTS = ["sales", "service", "parts", "crown", "fuel", "overhead"];

var COSTCO_GAS_WHY = "Fuel. Usually lot / shuttle. Confirm it isn’t a demo fill.";
var FUEL_WHY = "Fuel. Usually lot / shuttle.";

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function extractIncludedHst(gross) {
  var net = round2(gross / 1.13);
  var tax = round2(gross - net);
  return { net: net, tax: tax };
}

function hay(description) {
  return String(description || "").toLowerCase();
}

function isCostcoWholesaleNotGas(h) {
  return /\bcostco\b/.test(h) && /\bwholesale\b/.test(h) && !/\bgas\b/.test(h) && !/\bfuel\b/.test(h);
}

function isFuelMerchant(description) {
  var h = hay(description);
  if (!h) return false;
  if (isCostcoWholesaleNotGas(h)) return false;
  if (/\bcostco\s+gas\b/.test(h)) return true;
  if (/\b(petro[- ]?can(?:ada)?|petrocan)\b/.test(h)) return true;
  if (/\b(esso|mobil|ultramar)\b/.test(h)) return true;
  if (/\bshell\b/.test(h)) return true;
  if (/\bcircle\s*k\b/.test(h)) return true;
  if (/\bpioneer\b/.test(h) && /\b(stn|station|gas|#)\b/.test(h)) return true;
  if (/\bgas(?:oline)?\s*(?:stn|station|#|\d)/.test(h)) return true;
  if (/\bfuel\s*(?:stn|station|#|\d)/.test(h)) return true;
  return false;
}

function fuelWhy(description) {
  return /\bcostco\s+gas\b/i.test(description) ? COSTCO_GAS_WHY : FUEL_WHY;
}

function fuelContainsToken(description) {
  var h = hay(description);
  if (/\bcostco\s+gas\b/.test(h)) return "costco gas";
  if (/\bpetrocan\b/.test(h)) return "petrocan";
  if (/\bpetro[- ]?canada\b/.test(h)) return "petro-canada";
  if (/\besso\b/.test(h)) return "esso";
  if (/\bmobil\b/.test(h)) return "mobil";
  if (/\bshell\b/.test(h)) return "shell";
  if (/\bultramar\b/.test(h)) return "ultramar";
  if (/\bcircle\s*k\b/.test(h)) return "circle k";
  if (/\bgas\s+stn\b/.test(h)) return "gas stn";
  return "gas";
}

function merchantHint(description) {
  if (!isFuelMerchant(description)) return null;
  return {
    id: "br-fuel-" + fuelContainsToken(description).replace(/\s+/g, "-"),
    contains: fuelContainsToken(description),
    account: FUEL_GL,
    department: "fuel",
    hst: "included",
    why: fuelWhy(description),
    source: "merchant",
  };
}

function lookupLearned(description, rules) {
  var h = hay(description);
  var hits = (rules || []).filter(function (r) {
    return r && r.contains && h.indexOf(String(r.contains).toLowerCase()) >= 0;
  });
  if (!hits.length) return undefined;
  return hits.sort(function (a, b) {
    return String(b.contains).length - String(a.contains).length;
  })[0];
}

function learnedIsFuel(rule) {
  return !!(rule && rule.department === "fuel" && String(rule.account) === FUEL_GL);
}

function matchRule(description, rules) {
  var hint = merchantHint(description);
  var learned = lookupLearned(description, rules);
  if (hint && !learnedIsFuel(learned)) return hint;
  return learned;
}

function learnRule(description, account, department, hst) {
  if (isFuelMerchant(description)) {
    department = "fuel";
    account = FUEL_GL;
    hst = "included";
  }
  var token =
    String(description || "")
      .replace(/[0-9#*]/g, " ")
      .split(/\s+/)
      .filter(function (w) {
        return w.length > 3;
      })
      .slice(0, 2)
      .join(" ")
      .toLowerCase() || String(description || "").slice(0, 12).toLowerCase();
  if (department === "fuel") token = fuelContainsToken(description);
  return {
    id: "br-" + token.replace(/\s+/g, "-"),
    contains: token,
    account: account,
    department: department,
    hst: hst,
  };
}

function accountForBank(department, amount) {
  if (amount >= 0) return AR_GL;
  if (department === "parts") return PARTS_GL;
  if (department === "sales") return SALES_GL;
  if (department === "fuel") return FUEL_GL;
  return OVERHEAD_GL;
}

function hstForBank(department, amount) {
  if (amount >= 0) return "none";
  if (department === "crown" || department === "parts" || department === "overhead" || department === "sales" || department === "fuel") {
    return "included";
  }
  return "none";
}

function resolveBankCoding(description, rules, clickedDept, explicitAccount, amount) {
  var hint = merchantHint(description);
  var learned = lookupLearned(description, rules);
  if (hint) {
    return {
      department: "fuel",
      account: explicitAccount || FUEL_GL,
      hst: "included",
      why: hint.why,
      contains: hint.contains,
      source: learnedIsFuel(learned) ? "learned" : "merchant",
      rule: hint,
    };
  }
  var dept = clickedDept || (learned && learned.department) || "overhead";
  var acct = explicitAccount || (learned && learned.account) || accountForBank(dept, amount || -1);
  var hst = (learned && learned.hst) || hstForBank(dept, amount || -1);
  return {
    department: dept,
    account: acct,
    hst: hst,
    why: learned ? "Seen before · " + learned.contains : undefined,
    contains: learned && learned.contains,
    source: learned ? "learned" : "clicked",
    rule: learned,
  };
}

function parseBankCsv(text) {
  var lines = String(text || "")
    .split(/\r?\n/)
    .map(function (l) {
      return l.trim();
    })
    .filter(Boolean);
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (/^date/i.test(line) || /^transaction/i.test(line)) continue;
    var parts = line.split(/,|\t/).map(function (p) {
      return p.replace(/^"|"$/g, "").trim();
    });
    if (parts.length < 3) continue;
    var dateRaw = parts[0];
    var desc = parts[1] || parts[2];
    var amtRaw = parts[parts.length - 1].replace(/[$,]/g, "");
    var amount = Number(amtRaw);
    if (!Number.isFinite(amount) || !desc) continue;
    var d = dateRaw.slice(0, 10);
    var date = d.indexOf("/") >= 0
      ? d.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, function (_, m, day, y) {
          return y + "-" + m.padStart(2, "0") + "-" + day.padStart(2, "0");
        })
      : d;
    out.push({ date: date, description: desc, amount: amount });
  }
  return out;
}

function journalLine(account, debit, credit, department) {
  return {
    account: account,
    debit: round2(debit),
    credit: round2(credit),
    department: department || undefined,
  };
}

function journalFromBank(tx, account, department, hst, createdBy) {
  var abs = round2(Math.abs(tx.amount));
  var id = "j-bank-" + tx.id;
  var memo = tx.description;
  var source = "bank:" + tx.id;
  if (tx.amount >= 0) {
    return {
      id: id,
      date: tx.date,
      memo: memo,
      source: source,
      createdBy: createdBy,
      lines: [journalLine(CASH_GL, abs, 0), journalLine(account, 0, abs, department)],
    };
  }
  if (hst === "included") {
    var split = extractIncludedHst(abs);
    return {
      id: id,
      date: tx.date,
      memo: memo,
      source: source,
      createdBy: createdBy,
      lines: [
        journalLine(account, split.net, 0, department),
        journalLine(ITC_GL, split.tax, 0),
        journalLine(CASH_GL, 0, abs),
      ],
    };
  }
  return {
    id: id,
    date: tx.date,
    memo: memo,
    source: source,
    createdBy: createdBy,
    lines: [journalLine(account, abs, 0, department), journalLine(CASH_GL, 0, abs)],
  };
}

function expenseAccountFromJournal(journal) {
  if (!journal || !journal.lines) return undefined;
  var hit = journal.lines.find(function (l) {
    return l.debit > 0 && l.account !== CASH_GL && l.account !== ITC_GL;
  });
  return hit && hit.account;
}

function expenseDeptFromJournal(journal) {
  if (!journal || !journal.lines) return undefined;
  var hit = journal.lines.find(function (l) {
    return l.debit > 0 && l.account !== CASH_GL && l.account !== ITC_GL;
  });
  return hit && hit.department;
}

function autoPostBank(bank, journals, rules, createdBy) {
  var js = journals ? journals.slice() : [];
  var next = (bank || []).map(function (tx) {
    if (tx.status !== "unmatched") {
      return applyMerchantSuggestion(tx);
    }
    var coding = resolveBankCoding(tx.description, rules, undefined, undefined, tx.amount);
    if (!coding.rule && coding.source !== "merchant") {
      return applyMerchantSuggestion(tx);
    }
    if (coding.department !== "fuel" && !lookupLearned(tx.description, rules)) {
      return applyMerchantSuggestion(tx);
    }
    try {
      var j = journalFromBank(tx, coding.account, coding.department, coding.hst, createdBy);
      js = [j].concat(js.filter(function (x) {
        return x.id !== j.id;
      }));
      return {
        status: "matched",
        matchedDept: coding.department,
        suggested: coding.department,
        suggestedWhy: coding.why || ("Seen before · " + (coding.contains || "")),
        date: tx.date,
        amount: tx.amount,
        description: tx.description,
        id: tx.id,
        receipts: tx.receipts,
      };
    } catch (e) {
      return applyMerchantSuggestion(tx);
    }
  });
  return { bank: next, journals: js };
}

function postBankMatch(tx, rules, clickedDept, explicitAccount, createdBy) {
  if (!tx || tx.status !== "unmatched") return null;
  var coding = resolveBankCoding(tx.description, rules, clickedDept, explicitAccount, tx.amount);
  var rule = learnRule(tx.description, coding.account, coding.department, coding.hst);
  var journal = journalFromBank(tx, coding.account, coding.department, coding.hst, createdBy);
  var seen = (rules || []).some(function (r) {
    return r.contains === rule.contains;
  });
  var nextRules = seen
    ? migrateBankRules(rules).map(function (r) {
        if (r.contains === rule.contains && isFuelMerchant(tx.description)) return rule;
        return r;
      })
    : [rule].concat(migrateBankRules(rules || []));
  return {
    tx: {
      id: tx.id,
      date: tx.date,
      amount: tx.amount,
      description: tx.description,
      status: "matched",
      matchedDept: coding.department,
      suggested: coding.department,
      suggestedWhy: coding.why,
      receipts: tx.receipts,
    },
    journal: journal,
    rule: rule,
    bankRules: nextRules,
    coding: coding,
  };
}

function applyMerchantSuggestion(tx) {
  var hint = merchantHint(tx.description);
  if (!hint) return tx;
  if (tx.status === "matched" && tx.matchedDept === "fuel") return tx;
  if (tx.status === "unmatched" || !tx.status) {
    return Object.assign({}, tx, {
      suggested: "fuel",
      suggestedWhy: hint.why,
    });
  }
  return tx;
}

function annotateBankHints(bank) {
  return (bank || []).map(applyMerchantSuggestion);
}

function defaultBankRules() {
  return [
    { id: "br-napa", contains: "napa", account: PARTS_GL, department: "parts", hst: "included" },
    { id: "br-uap", contains: "uap", account: PARTS_GL, department: "parts", hst: "included" },
    { id: "br-hydro", contains: "hydro", account: OVERHEAD_GL, department: "overhead", hst: "included" },
    { id: "br-bell", contains: "bell canada", account: OVERHEAD_GL, department: "overhead", hst: "included" },
    { id: "br-costco-gas", contains: "costco gas", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-petro", contains: "petrocan", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-petro-canada", contains: "petro-canada", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-esso", contains: "esso", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-mobil", contains: "mobil", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-shell-gas", contains: "shell", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-gas-stn", contains: "gas stn", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-tim", contains: "tim hortons", account: OVERHEAD_GL, department: "overhead", hst: "none" },
    { id: "br-krown-fee", contains: "krown franchise", account: OVERHEAD_GL, department: "crown", hst: "included" },
    { id: "br-crown-rust", contains: "crown rust", account: OVERHEAD_GL, department: "crown", hst: "included" },
    { id: "br-afc-int", contains: "afc interest", account: "5310", department: "sales", hst: "none" },
    { id: "br-afc-adv", contains: "afc floor", account: "2010", department: "sales", hst: "none" },
    { id: "br-td-dep", contains: "td dep deal", account: AR_GL, department: "sales", hst: "none" },
    { id: "br-rent", contains: "rent", account: OVERHEAD_GL, department: "overhead", hst: "none" },
  ];
}

function migrateBankRules(rules) {
  return (rules || []).map(function (r) {
    if (!r) return r;
    var probe = r.contains || r.id || "";
    if (isFuelMerchant(probe) || isFuelMerchant(" " + probe + " ")) {
      if (r.department !== "fuel" || String(r.account) !== FUEL_GL) {
        return Object.assign({}, r, { account: FUEL_GL, department: "fuel", hst: "included" });
      }
    }
    return r;
  });
}

function repairFuelMatches(bank, journals, rules, createdBy) {
  var nextRules = migrateBankRules(rules);
  var js = (journals || []).slice();
  var nextBank = (bank || []).map(function (tx) {
    if (!isFuelMerchant(tx.description)) return tx;
    if (tx.status === "ignored") return tx;
    var coding = resolveBankCoding(tx.description, nextRules, "fuel", FUEL_GL, tx.amount);
    var j = journalFromBank(tx, coding.account, "fuel", "included", createdBy || "u-christine");
    js = [j].concat(js.filter(function (x) {
      return x.id !== j.id && x.source !== "bank:" + tx.id;
    }));
    return Object.assign({}, tx, {
      status: "matched",
      matchedDept: "fuel",
      suggested: "fuel",
      suggestedWhy: coding.why,
    });
  });
  return { bank: nextBank, journals: js, bankRules: nextRules };
}

function uiMatchLabel(tx) {
  var dept = tx.status === "matched" ? tx.matchedDept : tx.suggested;
  return (tx.status || "unmatched") + (dept ? " · " + (DEPT_LABEL[dept] || dept) : "");
}

var SAMPLE_BANK_CSV = "Date,Description,Amount\n" +
  "2026-09-02,TD DEP AFC FLOOR ADV,18400.00\n" +
  "2026-09-02,NAPA AUTOPRO ROCKLAND,-1847.22\n" +
  "2026-09-02,HYDRO ONE #441,-612.40\n" +
  "2026-09-03,BELL CANADA,-214.88\n" +
  "2026-09-03,PETROCAN ROCKLAND,-84.22\n" +
  "2026-09-03,TIM HORTONS #2411,-18.40\n" +
  "2026-09-03,UAP OTTAWA,-966.10\n" +
  "2026-09-03,KROWN FRANCHISE FEE,-450.00\n" +
  "2026-09-03,TD DEP DEAL SPORTAGE CHO,24880.00\n" +
  "2026-09-01,AFC INTEREST G201,-118.60";

var SEED_COSTCO_GAS = {
  id: "bx-1",
  date: "2026-09-01",
  amount: -84.22,
  description: "COSTCO GAS #1241 MISSISSAUGA",
  status: "unmatched",
  suggested: "fuel",
  suggestedWhy: COSTCO_GAS_WHY,
};

function defaultCardRules() {
  return [
    { id: "cr-google", contains: "google", account: SALES_GL, department: "sales", hst: "included" },
    { id: "cr-meta", contains: "meta", account: SALES_GL, department: "sales", hst: "included" },
    { id: "cr-linkedin", contains: "linkedin", account: SALES_GL, department: "sales", hst: "included" },
    { id: "cr-staples", contains: "staples", account: OVERHEAD_GL, department: "overhead", hst: "included" },
    { id: "cr-amazon", contains: "amazon", account: OVERHEAD_GL, department: "overhead", hst: "included" },
    { id: "cr-microsoft", contains: "microsoft", account: OVERHEAD_GL, department: "overhead", hst: "included" },
    { id: "cr-apple", contains: "apple", account: OVERHEAD_GL, department: "overhead", hst: "included" },
    { id: "cr-keg", contains: "keg", account: OVERHEAD_GL, department: "sales", hst: "included" },
    { id: "cr-western", contains: "western", account: OVERHEAD_GL, department: "sales", hst: "included" },
    { id: "cr-shell", contains: "shell", account: FUEL_GL, department: "fuel", hst: "included" },
  ];
}

function accountForCard(tx, department) {
  if (tx && tx.rail === "shell") return FUEL_GL;
  if (department === "fuel") return FUEL_GL;
  if (department === "parts") return PARTS_GL;
  if (department === "sales" && /ads|google|meta|linkedin|facebook/i.test(((tx && tx.merchant) || "") + " " + ((tx && tx.description) || ""))) {
    return SALES_GL;
  }
  return OVERHEAD_GL;
}

module.exports = {
  FUEL_GL: FUEL_GL,
  OVERHEAD_GL: OVERHEAD_GL,
  DEPT_LABEL: DEPT_LABEL,
  DEPTS: DEPTS,
  COSTCO_GAS_WHY: COSTCO_GAS_WHY,
  SEED_COSTCO_GAS: SEED_COSTCO_GAS,
  SAMPLE_BANK_CSV: SAMPLE_BANK_CSV,
  isFuelMerchant: isFuelMerchant,
  merchantHint: merchantHint,
  matchRule: matchRule,
  learnRule: learnRule,
  accountForBank: accountForBank,
  hstForBank: hstForBank,
  resolveBankCoding: resolveBankCoding,
  parseBankCsv: parseBankCsv,
  journalFromBank: journalFromBank,
  expenseAccountFromJournal: expenseAccountFromJournal,
  expenseDeptFromJournal: expenseDeptFromJournal,
  autoPostBank: autoPostBank,
  postBankMatch: postBankMatch,
  applyMerchantSuggestion: applyMerchantSuggestion,
  annotateBankHints: annotateBankHints,
  defaultBankRules: defaultBankRules,
  migrateBankRules: migrateBankRules,
  repairFuelMatches: repairFuelMatches,
  uiMatchLabel: uiMatchLabel,
  defaultCardRules: defaultCardRules,
  accountForCard: accountForCard,
};

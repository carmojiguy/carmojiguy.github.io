import type { BankRule, BankTx, Department, Journal } from "@/lib/types";
import { extractIncludedHst } from "./tax-canada.ts";
import { cr, dr, makeJournal } from "./journal.ts";
import { round2 } from "./money.ts";

/** Fuel expense. Bank + Shell Fleet. Not Overhead 5300, not Parts 1200. */
export const FUEL_GL = "5330";

export function isFuelMerchant(description: string) {
  const h = description.toLowerCase();
  if (/\bcostco\b/.test(h) && /\bwholesale\b/.test(h) && !/\bgas\b/.test(h) && !/\bfuel\b/.test(h)) {
    return false;
  }
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

function fuelContainsToken(description: string) {
  const h = description.toLowerCase();
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

function fuelWhy(description: string) {
  return /\bcostco\s+gas\b/i.test(description)
    ? "Fuel. Usually lot / shuttle. Confirm it isn’t a demo fill."
    : "Fuel. Usually lot / shuttle.";
}

export function merchantFuelRule(description: string): BankRule | undefined {
  if (!isFuelMerchant(description)) return undefined;
  return {
    id: `br-fuel-${fuelContainsToken(description).replace(/\s+/g, "-")}`,
    contains: fuelContainsToken(description),
    account: FUEL_GL,
    department: "fuel",
    hst: "included",
  };
}

export function parseBankCsv(text: string): { date: string; description: string; amount: number }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: { date: string; description: string; amount: number }[] = [];
  for (const line of lines) {
    if (/^date/i.test(line) || /^transaction/i.test(line)) continue;
    const parts = line.split(/,|\t/).map((p) => p.replace(/^"|"$/g, "").trim());
    if (parts.length < 3) continue;
    const dateRaw = parts[0];
    const desc = parts[1] || parts[2];
    const amtRaw = parts[parts.length - 1].replace(/[$,]/g, "");
    const amount = Number(amtRaw);
    if (!Number.isFinite(amount) || !desc) continue;
    const d = dateRaw.slice(0, 10);
    const date = d.includes("/")
      ? d.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, (_, m, day, y) => `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`)
      : d;
    out.push({ date, description: desc, amount });
  }
  return out;
}

function lookupLearned(description: string, rules: BankRule[]) {
  const hay = description.toLowerCase();
  const hits = rules.filter((r) => hay.includes(r.contains.toLowerCase()));
  if (!hits.length) return undefined;
  return hits.sort((a, b) => b.contains.length - a.contains.length)[0];
}

function learnedIsFuel(rule: BankRule | undefined) {
  return !!rule && rule.department === "fuel" && rule.account === FUEL_GL;
}

/** Longest learned contains, unless a fuel merchant hint must win over Overhead/Parts. */
export function matchRule(description: string, rules: BankRule[]) {
  const hint = merchantFuelRule(description);
  const learned = lookupLearned(description, rules);
  if (hint && !learnedIsFuel(learned)) return hint;
  return learned;
}

export function learnRule(description: string, account: string, department: Department, hst: BankRule["hst"]): BankRule {
  if (isFuelMerchant(description)) {
    department = "fuel";
    account = FUEL_GL;
    hst = "included";
  }
  const token = isFuelMerchant(description)
    ? fuelContainsToken(description)
    : description
        .replace(/[0-9#*]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 2)
        .join(" ")
        .toLowerCase() || description.slice(0, 12).toLowerCase();
  return {
    id: `br-${token.replace(/\s+/g, "-")}`,
    contains: token,
    account,
    department,
    hst,
  };
}

export function accountForBank(department: Department, amount: number) {
  if (amount >= 0) return "1310";
  if (department === "parts") return "1200";
  if (department === "sales") return "5320";
  if (department === "fuel") return FUEL_GL;
  return "5300";
}

export function hstForBank(department: Department, amount: number): BankRule["hst"] {
  if (amount >= 0) return "none";
  if (department === "crown" || department === "parts" || department === "overhead" || department === "sales" || department === "fuel") {
    return "included";
  }
  return "none";
}

/** Fuel merchants always code Fuel / 5330. Learned Overhead cannot win. */
export function resolveBankCoding(
  description: string,
  rules: BankRule[],
  clickedDept?: Department,
  explicitAccount?: string,
  amount = -1,
) {
  const hint = merchantFuelRule(description);
  const learned = lookupLearned(description, rules);
  if (hint) {
    return {
      department: "fuel" as const,
      account: explicitAccount || FUEL_GL,
      hst: "included" as const,
      why: fuelWhy(description),
      rule: hint,
    };
  }
  const department = clickedDept || learned?.department || "overhead";
  const account = explicitAccount || learned?.account || accountForBank(department, amount);
  const hst = learned?.hst || hstForBank(department, amount);
  return { department, account, hst, why: learned ? `Seen before · ${learned.contains}` : undefined, rule: learned };
}

export function journalFromBank(tx: BankTx, account: string, department: Department, hst: BankRule["hst"], createdBy: string): Journal {
  const abs = round2(Math.abs(tx.amount));
  if (tx.amount >= 0) {
    return makeJournal({
      id: `j-bank-${tx.id}`,
      date: tx.date,
      memo: tx.description,
      source: `bank:${tx.id}`,
      createdBy,
      lines: [dr("1000", abs), cr(account, abs, department)],
    });
  }
  if (hst === "included") {
    const { net, tax } = extractIncludedHst(abs);
    return makeJournal({
      id: `j-bank-${tx.id}`,
      date: tx.date,
      memo: tx.description,
      source: `bank:${tx.id}`,
      createdBy,
      lines: [dr(account, net, department), dr("1400", tax), cr("1000", abs)],
    });
  }
  return makeJournal({
    id: `j-bank-${tx.id}`,
    date: tx.date,
    memo: tx.description,
    source: `bank:${tx.id}`,
    createdBy,
    lines: [dr(account, abs, department), cr("1000", abs)],
  });
}

export function autoPostBank(
  bank: BankTx[],
  journals: Journal[],
  rules: BankRule[],
  createdBy: string,
): { bank: BankTx[]; journals: Journal[] } {
  let js = journals;
  const next = bank.map((tx) => {
    if (tx.status !== "unmatched") return suggestFuelIfNeeded(tx);
    const coding = resolveBankCoding(tx.description, rules, undefined, undefined, tx.amount);
    if (!coding.rule) return suggestFuelIfNeeded(tx);
    try {
      const j = journalFromBank(tx, coding.account, coding.department, coding.hst, createdBy);
      js = [j, ...js.filter((x) => x.id !== j.id)];
      return {
        ...tx,
        status: "matched" as const,
        matchedDept: coding.department,
        suggested: coding.department,
        suggestedWhy: coding.why || `Seen before · ${coding.rule.contains}`,
      };
    } catch {
      return suggestFuelIfNeeded(tx);
    }
  });
  return { bank: next, journals: js };
}

export function suggestFuelIfNeeded(tx: BankTx): BankTx {
  if (!isFuelMerchant(tx.description)) return tx;
  if (tx.status === "unmatched") {
    return { ...tx, suggested: "fuel", suggestedWhy: fuelWhy(tx.description) };
  }
  return tx;
}

export function migrateBankRules(rules: BankRule[]): BankRule[] {
  return rules.map((r) => {
    if (isFuelMerchant(r.contains) || isFuelMerchant(` ${r.contains} `)) {
      if (r.department !== "fuel" || r.account !== FUEL_GL) {
        return { ...r, account: FUEL_GL, department: "fuel", hst: "included" };
      }
    }
    return r;
  });
}

export const SAMPLE_BANK_CSV = `Date,Description,Amount
2026-09-02,TD DEP AFC FLOOR ADV,18400.00
2026-09-02,NAPA AUTOPRO ROCKLAND,-1847.22
2026-09-02,HYDRO ONE #441,-612.40
2026-09-03,BELL CANADA,-214.88
2026-09-03,PETROCAN ROCKLAND,-84.22
2026-09-03,TIM HORTONS #2411,-18.40
2026-09-03,UAP OTTAWA,-966.10
2026-09-03,KROWN FRANCHISE FEE,-450.00
2026-09-03,TD DEP DEAL SPORTAGE CHO,24880.00
2026-09-01,AFC INTEREST G201,-118.60`;

export function defaultBankRules(): BankRule[] {
  return [
    { id: "br-napa", contains: "napa", account: "1200", department: "parts", hst: "included" },
    { id: "br-uap", contains: "uap", account: "1200", department: "parts", hst: "included" },
    { id: "br-hydro", contains: "hydro", account: "5300", department: "overhead", hst: "included" },
    { id: "br-bell", contains: "bell canada", account: "5300", department: "overhead", hst: "included" },
    { id: "br-costco-gas", contains: "costco gas", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-petro", contains: "petrocan", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-petro-canada", contains: "petro-canada", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-esso", contains: "esso", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-mobil", contains: "mobil", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-shell-gas", contains: "shell", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-gas-stn", contains: "gas stn", account: FUEL_GL, department: "fuel", hst: "included" },
    { id: "br-tim", contains: "tim hortons", account: "5300", department: "overhead", hst: "none" },
    { id: "br-krown-fee", contains: "krown franchise", account: "5300", department: "crown", hst: "included" },
    { id: "br-crown-rust", contains: "crown rust", account: "5300", department: "crown", hst: "included" },
    { id: "br-afc-int", contains: "afc interest", account: "5310", department: "sales", hst: "none" },
    { id: "br-afc-adv", contains: "afc floor", account: "2010", department: "sales", hst: "none" },
    { id: "br-td-dep", contains: "td dep deal", account: "1310", department: "sales", hst: "none" },
    { id: "br-rent", contains: "rent", account: "5300", department: "overhead", hst: "none" },
  ];
}

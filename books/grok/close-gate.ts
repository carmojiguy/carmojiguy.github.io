/**
 * Grok drop-in for BOOKS-BANK-001.
 *
 * Live Ct() (src/routes/_app/accounting.tsx vin schedule) never reads bank.
 * Flow Bank rec counts every unmatched line. Bank → Reconcile unmatched is
 * date-filtered. Close toasted "Day closed" while Flow still showed 1.
 *
 * Apply with books/grok/wire-close.ts. Do not change VIN/floor math here
 * (BOOKS-FLOOR-TIE-001). Do not touch Appraisal Center / atomic-deliver.
 */

export type BankTxStatus = "unmatched" | "matched" | "ignored";

export type BankTx = {
  id: string;
  date: string;
  status: BankTxStatus;
  description?: string;
  amount?: number;
};

export type VinClose = {
  booksOk: boolean;
  blockReason: string;
  inventoryOk?: boolean;
  floorOk?: boolean;
  unitDrift?: unknown[];
  vinOk?: boolean;
  [key: string]: unknown;
};

export type CloseGate = VinClose & {
  unmatchedBank: number;
  bankOk: boolean;
  vinOk: boolean;
  closeDisabled: boolean;
  statementLocked: boolean;
  statementBanner: string | null;
};

export function unmatchedBankLines(bank: BankTx[] | undefined) {
  return (bank || []).filter((tx) => tx && tx.status === "unmatched");
}

export function unmatchedBankCount(bank: BankTx[] | undefined) {
  return unmatchedBankLines(bank).length;
}

export function unmatchedBankReason(count: number) {
  const n = Number(count) || 0;
  if (n <= 0) return "";
  if (n === 1) return "1 unmatched bank line";
  return `${n} unmatched bank lines`;
}

export function flowBankRec(bank: BankTx[] | undefined) {
  const open = unmatchedBankCount(bank);
  return {
    id: "bank" as const,
    label: "Bank rec",
    open,
    hint: open ? `${open} unmatched` : "Tied",
  };
}

function joinReasons(parts: Array<string | undefined | null>) {
  return parts.filter(Boolean).join(" · ");
}

export function withBankCloseGate(vin: VinClose | undefined, bank: BankTx[] | undefined): CloseGate {
  const src = vin || ({ booksOk: true, blockReason: "" } as VinClose);
  const unmatched = unmatchedBankCount(bank);
  const bankOk = unmatched === 0;
  let vinOk = src.vinOk;
  if (vinOk == null) vinOk = src.booksOk !== false;
  const vinReason = vinOk ? "" : String(src.blockReason || "").trim();
  const bankReason = unmatchedBankReason(unmatched);
  const blockReason = joinReasons([vinReason, bankReason]);
  const booksOk = Boolean(vinOk) && bankOk;
  return {
    ...src,
    unmatchedBank: unmatched,
    bankOk,
    vinOk: Boolean(vinOk),
    booksOk,
    blockReason: booksOk ? "" : blockReason,
    closeDisabled: !booksOk,
    statementLocked: !booksOk,
    statementBanner: booksOk ? null : `Statement pack blocked. ${blockReason}`,
  };
}

export function closeTheDay(gate: CloseGate) {
  const unmatched = gate?.unmatchedBank || 0;
  if (gate?.booksOk && unmatched <= 0) {
    return { ok: true, closed: true, blocked: false, toast: "Day closed" as const, reason: "" };
  }
  const reason =
    gate?.blockReason && /unmatched bank/.test(gate.blockReason)
      ? gate.blockReason
      : [gate?.blockReason, unmatchedBankReason(unmatched)].filter(Boolean).join(" · ");
  return { ok: false, closed: false, blocked: true, toast: null, reason };
}

export function openStatementPack(gate: CloseGate) {
  const unmatched = gate?.unmatchedBank || 0;
  if (gate?.booksOk && unmatched <= 0) {
    return { ok: true, blocked: false, locked: false, reason: "", banner: null };
  }
  const reason =
    gate?.blockReason && /unmatched bank/.test(gate.blockReason)
      ? gate.blockReason
      : [gate?.blockReason, unmatchedBankReason(unmatched)].filter(Boolean).join(" · ");
  return {
    ok: false,
    blocked: true,
    locked: true,
    reason,
    banner: `Statement pack blocked. ${reason}`,
  };
}

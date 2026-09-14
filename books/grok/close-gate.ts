/**
 * Grok drop-in for BOOKS-BANK-001 + BOOKS-BANK-BADGE-001.
 *
 * Authoritative unmatched count is the live Bank → Reconcile filter
 * (unmatched AND in the Bank date range). Flow Bank rec badge must use
 * that same count. Close must NOT use the old all-dates Flow formula.
 *
 * Apply with books/grok/wire-close.ts. Do not change VIN/floor math
 * (BOOKS-FLOOR-TIE-001). Toast "Day closed" is not a period lock (BOOKS-006).
 */

export const BANK_CLOSE_BLOCK = "Clear unmatched bank lines before close";

export type BankTxStatus = "unmatched" | "matched" | "ignored";

export type BankTx = {
  id: string;
  date: string;
  status: BankTxStatus;
  description?: string;
  amount?: number;
};

export type DateRange = {
  start?: string;
  end?: string;
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
  range: DateRange | null;
};

function inDateRange(date: string | undefined, start?: string, end?: string) {
  const d = String(date || "").slice(0, 10);
  if (!d) return false;
  if (start && d < String(start).slice(0, 10)) return false;
  if (end && d > String(end).slice(0, 10)) return false;
  return true;
}

export function bankUnmatchedLines(bank: BankTx[] | undefined, range?: DateRange) {
  const start = range?.start;
  const end = range?.end;
  return (bank || []).filter((tx) => {
    if (!tx || tx.status !== "unmatched") return false;
    if (start == null && end == null) return true;
    return inDateRange(tx.date, start, end);
  });
}

export function bankUnmatchedCount(bank: BankTx[] | undefined, range?: DateRange) {
  return bankUnmatchedLines(bank, range).length;
}

export function unmatchedBankReason(count: number) {
  return (Number(count) || 0) > 0 ? BANK_CLOSE_BLOCK : "";
}

export function flowBankRec(bank: BankTx[] | undefined, range?: DateRange) {
  const open = bankUnmatchedCount(bank, range);
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

export function withBankCloseGate(
  vin: VinClose | undefined,
  bank: BankTx[] | undefined,
  range?: DateRange,
): CloseGate {
  const src = vin || ({ booksOk: true, blockReason: "" } as VinClose);
  const unmatched = bankUnmatchedCount(bank, range);
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
    range: range || null,
  };
}

export function closeTheDay(gate: CloseGate) {
  const unmatched = gate?.unmatchedBank || 0;
  if (gate?.booksOk && unmatched <= 0) {
    return {
      ok: true,
      closed: true,
      blocked: false,
      toast: "Day closed" as const,
      reason: "",
      periodLocked: false as const,
    };
  }
  const reason =
    gate?.blockReason && gate.blockReason.includes(BANK_CLOSE_BLOCK)
      ? gate.blockReason
      : joinReasons([gate?.blockReason, unmatchedBankReason(unmatched)]);
  return { ok: false, closed: false, blocked: true, toast: null, reason, periodLocked: false as const };
}

export function openStatementPack(gate: CloseGate) {
  const unmatched = gate?.unmatchedBank || 0;
  if (gate?.booksOk && unmatched <= 0) {
    return { ok: true, blocked: false, locked: false, reason: "", banner: null };
  }
  const reason =
    gate?.blockReason && gate.blockReason.includes(BANK_CLOSE_BLOCK)
      ? gate.blockReason
      : joinReasons([gate?.blockReason, unmatchedBankReason(unmatched)]);
  return {
    ok: false,
    blocked: true,
    locked: true,
    reason,
    banner: `Statement pack blocked. ${reason}`,
  };
}

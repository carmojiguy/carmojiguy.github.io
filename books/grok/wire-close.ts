/**
 * Grok wiring for BOOKS-BANK-001 + BOOKS-BANK-BADGE-001.
 *
 * Apply together with books/grok/close-gate.ts.
 * Books is the grok.me app (birch-lake-zinc-dawn), not the Trade-in HTML.
 *
 * Authoritative unmatched count = live Bank → Reconcile `K`:
 *
 *   bankUnmatchedCount(state.bank, { start: range.start, end: range.end })
 *   === bank.filter((tx) => tx.status === "unmatched" && inRange(tx.date)).length
 *
 * Close, Statement pack, Flow Bank rec badge, and Bank header ALL use that.
 * Do NOT use bank.filter(tx => tx.status === "unmatched").length (old Flow).
 * Do NOT gate Close on the Flow badge when Bank Today is 0.
 *
 * src/routes/_app/accounting.tsx
 *
 * 0. Same date range as the Bank Today bar (`w.start` / `w.end`):
 *
 *      const range = { start: w.start, end: w.end };
 *
 * 1. After vinSchedule / Ct(journals, vehicles):
 *
 *      const vin = vinSchedule(journals, vehicles);
 *      const q = withBankCloseGate(vin, bank, range);
 *
 *    Do not fold bank into VIN/floor math (FLOOR-TIE is separate).
 *    If Bank unmatched > 0, q.blockReason includes
 *    "Clear unmatched bank lines before close" even when floor/liens also fire.
 *
 * 2. Close the day
 *
 *      <Button
 *        disabled={!q.booksOk}
 *        onClick={() => {
 *          const result = closeTheDay(q);
 *          if (!result.ok) { toast(result.reason); return; }
 *          toast(result.toast); // "Day closed" — NOT a period lock (BOOKS-006)
 *        }}
 *      >
 *        Close the day
 *      </Button>
 *
 * 3. Statement pack / accountant close
 *
 *      {q.statementBanner}
 *      <StatementPack locked={q.statementLocked} />
 *
 * 4. Stock VIN banner — unmatched-bank copy is not a VIN-untied claim:
 *
 *      if (q.booksOk) "VIN schedule ties. …"
 *      else if (q.vinOk) "Day closed and statement pack are blocked." + q.blockReason
 *      else "VIN schedule does not tie. …" + q.blockReason
 *
 * 5. Flow lanes (`_n` / flowDesk) — pass the Bank range:
 *
 *      const bankRec = flowBankRec(bank, range);
 *      // steps.bank.open = bankRec.open     // ≡ Bank unmatched
 *      // steps.bank.hint = bankRec.hint     // "1 unmatched" | "Tied"
 *
 * 6. Bank → Reconcile header unmatched N = bankUnmatchedCount(bank, range)
 *    (already K; keep K, do not switch K to all-dates).
 *
 * HOLD: Deliver / BOOKS-004, GitHub PRs #33 and #46, Appraisal Center #73.
 * Do not invent OpenLane solds. Do not change lien vs GL 2010 here.
 */

export {
  BANK_CLOSE_BLOCK,
  bankUnmatchedCount,
  withBankCloseGate,
  closeTheDay,
  openStatementPack,
  flowBankRec,
} from "./close-gate.ts";

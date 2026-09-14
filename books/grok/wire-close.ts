/**
 * Grok wiring for BOOKS-BANK-001 (unmatched-bank Close / Statement gate).
 *
 * Apply together with books/grok/close-gate.ts.
 * Books is the grok.me app (birch-lake-zinc-dawn), not the Trade-in HTML.
 *
 * Authoritative unmatched count — one source, no date filter:
 *
 *   unmatchedBankCount(state.bank)
 *   === bank.filter((tx) => tx.status === "unmatched").length
 *
 * Same number as Flow → Cash → Bank rec `open` / hint `${n} unmatched`.
 * Bank → Reconcile may still date-filter the *list*. Close, Statement pack,
 * Flow badge, and the Reconcile "unmatched N / rec is done" copy must not.
 *
 * src/routes/_app/accounting.tsx
 *
 * 1. After vinSchedule / Ct(journals, vehicles):
 *
 *      const vin = vinSchedule(journals, vehicles);
 *      const q = withBankCloseGate(vin, bank);
 *
 *    Do not fold bank into VIN/floor math. CFO split from FLOOR-TIE:
 *    unmatched>0 always appends the unmatched-bank reason even when
 *    floor/liens also fire.
 *
 * 2. Close the day
 *
 *      <Button
 *        disabled={!q.booksOk}
 *        onClick={() => {
 *          const result = closeTheDay(q);
 *          if (!result.ok) { toast(result.reason); return; }
 *          toast(result.toast); // "Day closed"
 *        }}
 *      >
 *        Close the day
 *      </Button>
 *
 *    Never toast "Day closed" when unmatchedBank > 0.
 *
 * 3. Statement pack / accountant close
 *
 *      disabled={!q.booksOk}
 *      onClick={() => {
 *        const result = openStatementPack(q);
 *        if (!result.ok) return; // banner already "Statement pack blocked. …"
 *        setView("statement");
 *      }}
 *
 *      {q.statementBanner}
 *      <StatementPack locked={q.statementLocked} />
 *
 * 4. Stock VIN banner — do not claim VIN is untied when only bank is open:
 *
 *      if (q.booksOk) "VIN schedule ties. …"
 *      else if (q.vinOk) "Day closed and statement pack are blocked." + q.blockReason
 *      else "VIN schedule does not tie. …" + q.blockReason
 *
 * 5. Flow lanes (`_n` / flowDesk):
 *
 *      const bankRec = flowBankRec(bank);
 *      // steps.bank.open = bankRec.open
 *      // steps.bank.hint = bankRec.hint   // "1 unmatched" | "Tied"
 *
 * 6. Bank → Reconcile header ("Books 1000 · unmatched N"):
 *
 *      unmatchedBankCount(bank)     // NOT the Today-filtered K
 *
 *    Visible rows can stay `inRange`. Empty-range copy must not say the
 *    rec is done when unmatchedBankCount > 0.
 *
 * HOLD: Deliver / BOOKS-004, GitHub PRs #33 and #46, Appraisal Center #73.
 * Do not invent OpenLane solds. Do not change lien vs GL 2010 here.
 */

export { unmatchedBankCount, withBankCloseGate, closeTheDay, openStatementPack, flowBankRec } from "./close-gate.ts";

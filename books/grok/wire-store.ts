/**
 * Grok drop-in patches for BOOKS-BANK-MATCH-LABEL (Costco Gas → Fuel / 5330).
 *
 * Apply together with books/grok/bank.ts (replaces src/lib/accounting/bank.ts).
 *
 * src/lib/types.ts
 *   export type Department = "sales" | "service" | "parts" | "crown" | "fuel" | "overhead";
 *   DEPT_LABEL.fuel = "Fuel"
 *
 * src/routes/_app/accounting.tsx
 *   const DEPTS: Department[] = ["sales", "service", "parts", "crown", "fuel", "overhead"];
 *
 * src/lib/seed.ts  (bx-1)
 *   suggested: "fuel"
 *   suggestedWhy stays: "Fuel. Usually lot / shuttle. Confirm it isn’t a demo fill."
 *
 * src/lib/accounting/cards.ts  defaultCardRules cr-shell:
 *   department: "fuel"  (account already 5330)
 *   accountForCard: if (department === "fuel") return "5330";
 *
 * src/lib/store.ts matchBank — use resolveBankCoding so a learned Overhead
 * rule cannot keep GL 5300 when the line is Costco Gas:
 *
 *   matchBank: (id, department, account) => {
 *     const tx = get().bank.find((b) => b.id === id);
 *     if (!tx || tx.status !== "unmatched") return;
 *     const coding = resolveBankCoding(tx.description, get().bankRules, department, account, tx.amount);
 *     const rule = learnRule(tx.description, coding.account, coding.department, coding.hst);
 *     const j = journalFromBank(tx, coding.account, coding.department, coding.hst, get().actingUser);
 *     const rules = migrateBankRules(get().bankRules);
 *     const seen = rules.some((r) => r.contains === rule.contains);
 *     set((s) => ({
 *       ...withJournal(s, j),
 *       bank: s.bank.map((b) =>
 *         b.id === id ? { ...b, status: "matched" as const, matchedDept: coding.department } : b,
 *       ),
 *       bankRules: seen
 *         ? rules.map((r) => (r.contains === rule.contains ? rule : r))
 *         : [rule, ...rules],
 *       alerts: s.alerts.filter((a) => a.kind !== "bank"),
 *     }));
 *   },
 *
 * Also migrateBankRules(state.bankRules) on persist rehydrate. Do not touch
 * atomic-deliver / BOOKS-004.
 */
export const GROK_FUEL_DEPT = "fuel" as const;
export const GROK_FUEL_GL = "5330";
export const GROK_BANK_DEPTS = ["sales", "service", "parts", "crown", "fuel", "overhead"] as const;

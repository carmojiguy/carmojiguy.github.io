/**
 * BOOKS-SORT-WO-001 — Grok drop-in for vendor bill → Work Order.
 *
 * Replaces the live dest list in src/routes/_app/accounting.tsx (Yt form,
 * photo/OCR and review share it) and extends postVendorBill in src/lib/store.ts.
 *
 * Live dests (accounting-CymDpuHW.js `Jt`) have no Work Order:
 *   parts | stock | krown | overhead
 */

export const BILL_GL: Record<string, string> = {
  wo: "1200",
  parts: "1200",
  stock: "1100",
  krown: "5700",
  overhead: "5300",
};

export const BILL_DESTS = [
  { id: "wo", label: "Work Order", hint: "Dr 1200 · cost on the RO until invoiced" },
  { id: "parts", label: "Parts shelf", hint: "Dr 1200 · sits until a RO uses it" },
  { id: "stock", label: "A stock number", hint: "Recon on the VIN · Dr 1100" },
  { id: "krown", label: "Krown supplies", hint: "Dr 5700" },
  { id: "overhead", label: "Overhead", hint: "Rent, hydro, phones · Dr 5300" },
] as const;

export type BillApply = (typeof BILL_DESTS)[number]["id"];

export function destDesk(apply: string) {
  if (apply === "stock") return "sales";
  if (apply === "parts") return "parts";
  if (apply === "krown") return "crown";
  if (apply === "wo") return "service";
  return "overhead";
}

export function applyFromScanText(text: string, vendor?: string) {
  const blob = `${text || ""} ${vendor || ""}`;
  if (/\bWO[-\s]?\d{3,}\b/i.test(blob)) return "wo" as const;
  const t = blob.toLowerCase();
  if (/krown|crown rust/.test(t)) return "krown" as const;
  if (/napa|uap|parts|kal tire|tire|filter|oil/.test(t)) return "parts" as const;
  if (/openlane|eblock|adesa|manheim|auction|wholesale/.test(t)) return "stock" as const;
  if (/hydro|bell|rogers|rent|insurance|telus|enbridge/.test(t)) return "overhead" as const;
  return "parts" as const;
}

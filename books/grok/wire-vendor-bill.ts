/**
 * Grok drop-in patches for BOOKS-SORT-WO-001 (Vendor bill Post → Work Order).
 *
 * Apply together with books/grok/vendor-bill.ts.
 * STOP before Publish. Do not merge this GitHub PR into a live Grok publish.
 * HOLD Deliver / BOOKS-004. HOLD PRs #33 #46. Do not touch PR #73.
 *
 * src/routes/_app/accounting.tsx  (Vendor bill form Yt — photo/OCR AND review)
 *
 *   const BILL_DESTS = [
 *     { id: "wo", label: "Work Order", hint: "Dr 1200 · cost on the RO until invoiced" },
 *     { id: "parts", label: "Parts shelf", hint: "Dr 1200 · sits until a RO uses it" },
 *     { id: "stock", label: "A stock number", hint: "Recon on the VIN · Dr 1100" },
 *     { id: "krown", label: "Krown supplies", hint: "Dr 5700" },
 *     { id: "overhead", label: "Overhead", hint: "Rent, hydro, phones · Dr 5300" },
 *   ];
 *
 *   After the dest chips, when apply === "wo", render an open-WO picker
 *   (same pattern as Receive Lt() in src/routes/_app.tsx: workOrders
 *   status !== "closed"). Pass woId into postVendorBill.
 *
 *   Submit currently only sends vehicleId when apply === "stock". Also send:
 *     woId: apply === "wo" ? selectedWoId : undefined
 *
 * src/lib/store.ts  BILL_GL / A map
 *
 *   A = { wo: "1200", parts: "1200", stock: "1100", krown: "5700", overhead: "5300" }
 *
 * src/lib/store.ts  validateVendorBill / st()
 *
 *   if (e.apply === "wo" && !findWorkOrder(e, workOrders))
 *     return { ok: false, error: "A work-order bill needs a work order." };
 *
 * src/lib/store.ts  journal xt()
 *
 *   desk: apply === "wo" ? "service" : existing ternary
 *   memo includes work order number when apply === "wo"
 *
 * src/lib/store.ts  postVendorBill
 *
 *   const wo = apply === "wo" ? workOrders.find(w => w.id === n.woId) : undefined;
 *   invoice.woId = wo?.id
 *   if (wo) append a parts line { sku, desc, qty, cost: net/qty or net } onto wo.parts
 *   Do NOT skip BILL-SKU: if n.sku, upsert catalog via partsAfterDestination(..., "work_order")
 *     so NAPA-ROT-992 stays searchable at qty 0.
 *
 * Receive setPartDestination (WO | Stock | Department) stays. Do not regress it.
 */
export const GROK_BILL_WO_APPLY = "wo" as const;
export const GROK_BILL_WO_GL = "1200";
export const GROK_BILL_WO_LABEL = "Work Order";

/**
 * Grok drop-in patches for BOOKS-SORT-WO-001 (Vendor bill Post → Work Order).
 *
 * Apply together with:
 *   books/grok/vendor-bill.ts
 *   books/grok/VendorBillDest.tsx
 *
 * STOP before Publish. Do not merge this GitHub PR into a live Grok publish.
 * HOLD Deliver / BOOKS-004. HOLD PRs #33 #46. Do not touch PR #73.
 *
 * src/routes/_app/accounting.tsx  Vendor bill form (Yt)
 *
 * LIVE FAIL after OCR (BOOKS-S1-001 / AUTO PARTS SUPPLY CO.): dest pills are
 *   Parts shelf | A stock number | Krown supplies | Overhead
 * No Work Order. Replace Jt in that OCR-review fragment with BILL_DESTS
 * (Work Order first). Render <VendorBillDestPicker /> in that pill row.
 * When apply === "wo", pass woId into postVendorBill so cost lands on the WO.
 *
 *   <p>Vendor bill</p>
 *   <p>Never type an invoice. Photo or PDF first — then review what the scan read. No image, no journal.</p>
 *   <VendorBillDestPicker
 *     apply={scan.apply}
 *     woId={woId}
 *     vehicleId={vehicleId}
 *     workOrders={workOrders}
 *     vehicles={lot}
 *     onApply={(id, gl) => setScan(s => ({ ...s, apply: id, gl }))}
 *     onWoId={setWoId}
 *     onVehicleId={setVehicleId}
 *   />
 *   {source ? <scan preview> : <Camera / Upload drop zone>}
 *   {source ? <vendor / amounts / submit> : null}
 *
 * BILL_DESTS must include { id: "wo", label: "Work Order", … } first.
 * Submit sends woId when apply === "wo" (today it only sends vehicleId for stock).
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
 * src/lib/store.ts  journal xt() + postVendorBill
 *
 *   desk: apply === "wo" ? "service" : existing ternary
 *   memo includes work order number
 *   invoice.woId = wo.id
 *   append a parts/cost line onto wo.parts
 *   if n.sku, partsAfterDestination(..., "work_order") so BILL-SKU qty 0 still indexes
 *
 * Receive setPartDestination (WO | Stock | Department) stays. Do not regress it.
 */
export const GROK_BILL_WO_APPLY = "wo" as const;
export const GROK_BILL_WO_GL = "1200";
export const GROK_BILL_WO_LABEL = "Work Order";
export const GROK_DESTS_NOT_GATED_ON_PHOTO = true;

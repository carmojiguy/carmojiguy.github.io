/**
 * Drop-in dest picker for src/routes/_app/accounting.tsx Vendor bill form (Yt).
 *
 * LIVE BUG after OCR (BOOKS-S1-001): dest pills are
 *   Parts shelf | A stock number | Krown supplies | Overhead
 * No Work Order. Replace that Jt row with this picker (Work Order first).
 *
 * Also fine to render it above Camera/Upload. Photo still required to post.
 *
 * HOLD Deliver / BOOKS-004. STOP before Publish. Do not touch PR #73.
 */

import { BILL_DESTS, BILL_GL } from "./vendor-bill";

type Wo = { id: string; number: string; status: string; concern: string };
type Unit = { id: string; stock: string; year: number; model: string };

export function VendorBillDestPicker(props: {
  apply: string;
  woId: string;
  vehicleId: string;
  workOrders: Wo[];
  vehicles: Unit[];
  onApply: (apply: string, gl: string) => void;
  onWoId: (id: string) => void;
  onVehicleId: (id: string) => void;
}) {
  const openWos = props.workOrders.filter((w) => w.status !== "closed");
  const hint = BILL_DESTS.find((d) => d.id === props.apply)?.hint;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {BILL_DESTS.map((d) => (
          <button
            key={d.id}
            type="button"
            data-dest={d.id}
            onClick={() => props.onApply(d.id, BILL_GL[d.id])}
            className={
              props.apply === d.id
                ? "rounded-full bg-foreground px-3 py-1.5 text-xs text-background"
                : "rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground"
            }
          >
            {d.label}
          </button>
        ))}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {props.apply === "wo" ? (
        <label className="block space-y-1.5">
          <span className="text-sm">Work order</span>
          <select
            className="flex h-11 w-full rounded-xl bg-background px-3 text-sm shadow-[var(--shadow-border)]"
            value={props.woId}
            onChange={(e) => props.onWoId(e.target.value)}
          >
            <option value="">Pick the RO</option>
            {openWos.map((w) => (
              <option key={w.id} value={w.id}>
                {w.number} · {w.concern.slice(0, 40)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {props.apply === "stock" ? (
        <label className="block space-y-1.5">
          <span className="text-sm">Unit</span>
          <select
            className="flex h-11 w-full rounded-xl bg-background px-3 text-sm shadow-[var(--shadow-border)]"
            value={props.vehicleId}
            onChange={(e) => props.onVehicleId(e.target.value)}
          >
            <option value="">Pick the VIN</option>
            {props.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.stock} · {v.year} {v.model}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

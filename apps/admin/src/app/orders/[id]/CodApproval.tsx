"use client";

import { useState } from "react";
import { decideCod, type OrderDetail } from "@/lib/api";
import { card, sectionTitle } from "./cardStyles";

/**
 * Zone A for a `cod_pending` order: the staff decision on collect-on-delivery. Only watch-tier orders
 * land here — best/good auto-approve at checkout, bad/block never get COD. Framed like Shipment: the
 * title + status pill on the left, the two decisions on the right. One click each (owner, 31 Jul):
 * approve → cod_confirmed (To ship), deny → cod_denied (the customer changes payment or cancels).
 */
export function CodApprovalSection({
  order,
  status,
  onError,
}: {
  order: OrderDetail["order"];
  status: { pill: string; label: string };
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<null | "approve" | "deny">(null);

  async function decide(decision: "approve" | "deny") {
    setBusy(decision);
    try {
      await decideCod(order.id, decision);
      location.reload();
    } catch (e) {
      onError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        ...card,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ ...sectionTitle, marginBottom: 6 }}>อนุมัติเก็บเงินปลายทาง</div>
        <span className={`pill ${status.pill}`}>{status.label}</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={busy !== null}
          onClick={() => void decide("approve")}
        >
          {busy === "approve" ? "กำลังอนุมัติ…" : "ตกลง"}
        </button>
        <button
          type="button"
          className="btn-soft btn-sm"
          disabled={busy !== null}
          onClick={() => void decide("deny")}
        >
          {busy === "deny" ? "กำลังปฏิเสธ…" : "ปฏิเสธ"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { decideCod, type OrderDetail } from "@/lib/api";
import { tableText } from "@/lib/tableText";
import { card, sectionTitle } from "./cardStyles";
import { useT } from "../../LangProvider";

/**
 * Zone A for a `cod_pending` order: the staff decision on collect-on-delivery. Only watch-tier orders
 * land here — best/good auto-approve at checkout, bad/block never get COD. Framed like Shipment: the
 * title + status pill on the left, the two decisions on the right. One click each (owner, 31 Jul):
 * approve → cod_confirmed (To ship), deny → cod_denied (the customer changes payment or cancels).
 */
export function CodApprovalSection({
  order,
  canAct,
  status,
  onError,
}: {
  order: OrderDetail["order"];
  /** COD approval is the super-admin's + admin's action; a mechanic sees it read-only. */
  canAct: boolean;
  /** Already translated by OrderDetailView — see the note there. */
  status: { pill: string; label: string };
  onError: (message: string) => void;
}) {
  const t = useT();
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
        <div style={{ ...sectionTitle, marginBottom: 6 }}>
          {t({ th: "อนุมัติเก็บเงินปลายทาง", en: "Approve cash on delivery" })}
        </div>
        <span className={`pill ${status.pill}`}>{status.label}</span>
      </div>
      {canAct ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={busy !== null}
            onClick={() => void decide("approve")}
          >
            {busy === "approve"
              ? t({ th: "กำลังอนุมัติ…", en: "Approving…" })
              : t({ th: "ตกลง", en: "Approve" })}
          </button>
          <button
            type="button"
            className="btn-soft btn-sm"
            disabled={busy !== null}
            onClick={() => void decide("deny")}
          >
            {busy === "deny"
              ? t({ th: "กำลังปฏิเสธ…", en: "Rejecting…" })
              : t({ th: "ปฏิเสธ", en: "Reject" })}
          </button>
        </div>
      ) : (
        <div style={tableText.subtitle}>
          {t({ th: "เฉพาะผู้ดูแลระดับสูงและผู้ดูแล", en: "Super admin and admin only" })}
        </div>
      )}
    </div>
  );
}

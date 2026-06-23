"use client";

import { useState } from "react";
import { refundSale } from "@/lib/api";

export function RefundButton({ saleId, status }: { saleId: string; status: string }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "refunded") return <span style={{ color: "var(--text-faint)" }}>refunded</span>;

  async function onClick() {
    if (!window.confirm("Refund this sale and restock the items?")) return;
    setBusy(true);
    try {
      const r = await refundSale(saleId);
      if (r.applied) {
        location.reload();
      } else {
        setMsg(r.reason ?? "not applied");
      }
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button onClick={onClick} disabled={busy}>
        Refund
      </button>{" "}
      {msg && <small style={{ color: "var(--danger)" }}>{msg}</small>}
    </span>
  );
}

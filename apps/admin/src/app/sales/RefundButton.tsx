"use client";

import { useState } from "react";
import { refundSale } from "@/lib/api";
import { ConfirmButton } from "../ConfirmButton";
import { useToast } from "../ToastProvider";

export function RefundButton({ saleId, status }: { saleId: string; status: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (status === "refunded") return <span style={{ color: "var(--text-faint)" }}>refunded</span>;

  async function doRefund() {
    setBusy(true);
    try {
      const r = await refundSale(saleId);
      if (r.applied) {
        toast(`Refunded — ${r.restockedLines} line(s) restocked`, "success");
        setTimeout(() => location.reload(), 700);
      } else {
        toast(r.reason ?? "Not applied", "error");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmButton onConfirm={doRefund} confirmLabel="Refund" disabled={busy}>
      Refund
    </ConfirmButton>
  );
}

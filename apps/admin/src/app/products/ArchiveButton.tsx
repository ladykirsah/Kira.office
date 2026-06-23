"use client";

import { useState } from "react";
import { archiveProduct } from "@/lib/api";
import { ConfirmButton } from "../ConfirmButton";
import { useToast } from "../ToastProvider";

export function ArchiveButton({ productId, status }: { productId: string; status: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (status === "archived") return <span style={{ color: "var(--text-faint)" }}>archived</span>;

  async function doArchive() {
    setBusy(true);
    try {
      await archiveProduct(productId);
      toast("Product archived", "success");
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmButton onConfirm={doArchive} confirmLabel="Archive" disabled={busy}>
      Archive
    </ConfirmButton>
  );
}

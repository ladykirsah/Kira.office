"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveProduct } from "@/lib/api";
import { useToast } from "../ToastProvider";

/** Danger zone — type DELETE to archive (soft-delete) the product, then return to the list. */
export function DeleteProductCard({ productId }: { productId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const armed = confirm === "DELETE";

  async function onDelete() {
    if (!armed || busy) return;
    setBusy(true);
    try {
      await archiveProduct(productId);
      toast("Product deleted", "success");
      router.push("/products");
    } catch (err) {
      toast((err as Error).message, "error");
      setBusy(false);
    }
  }

  return (
    <section className="danger-zone">
      <div>
        <div className="danger-zone-title">Delete product</div>
        <p className="danger-zone-text">
          Removes this product from your catalog and unlists it from Shopee. It is archived, so
          sales history is kept and you can restore it from the products list. Type{" "}
          <strong>DELETE</strong> to confirm.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type DELETE"
          aria-label="Type DELETE to confirm"
          style={{ width: 200 }}
        />
        <button type="button" className="btn-danger" disabled={!armed || busy} onClick={onDelete}>
          Delete product
        </button>
      </div>
    </section>
  );
}

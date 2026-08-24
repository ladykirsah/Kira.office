"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputS } from "@/lib/inputStyles";
import { archiveProduct } from "@/lib/api";
import { isDeleteConfirmed } from "@/lib/deleteConfirm";
import { canDeleteProduct } from "@l-shopee/core";
import { useStaffRole } from "../StaffRoleProvider";
import { useToast } from "../ToastProvider";

/**
 * Danger zone — type DELETE to archive (soft-delete) the product, then return to the list.
 *
 * Renders nothing at all for anyone but the super admin (owner, 2026-08-24). Hidden rather than
 * disabled: a greyed-out delete box invites "why can't I?", and the answer is not a fixable state.
 * The API refuses the same request independently — this only spares people a control they cannot use.
 */
export function DeleteProductCard({ productId }: { productId: string }) {
  const router = useRouter();
  const toast = useToast();
  const role = useStaffRole();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const armed = isDeleteConfirmed(confirm);

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

  // Null role = signed out or not yet known. Absence of proof is not permission.
  if (!role || !canDeleteProduct(role)) return null;

  return (
    <section className="danger-zone">
      <div>
        <div className="danger-zone-title">Delete product</div>
        <p className="danger-zone-text">
          Removes this product from your catalog and unlists it from Shopee. Its sales history is
          kept, so past orders and reports are unaffected. Type <strong>DELETE</strong> to confirm.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type DELETE"
          aria-label="Type DELETE to confirm"
          style={{ ...inputS, width: 200 }}
        />
        <button
          type="button"
          className="btn-danger btn-sm"
          disabled={!armed || busy}
          onClick={onDelete}
        >
          Delete product
        </button>
      </div>
    </section>
  );
}

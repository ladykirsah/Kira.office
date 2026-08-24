"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { canDeleteProduct } from "@l-shopee/core";
import { inputS } from "@/lib/inputStyles";
import { deleteProductForever } from "@/lib/api";
import { isDeleteConfirmed } from "@/lib/deleteConfirm";
import { useStaffRole } from "../StaffRoleProvider";
import { useToast } from "../ToastProvider";

/**
 * Deleting a product for good — and only that.
 *
 * Pausing used to live here as a second button. It moved out on 2026-08-24 (owner): taking a
 * product off the shop is now the "Live on AirPlus" switch on the edit form, and the same action in
 * the row menu. One control per idea, in one place each.
 *
 * That also fixed something the pairing had hidden. The delete box was rendered only when the
 * product was NOT paused, because a paused product showed a "put it back on sale" message instead —
 * so a paused product could not be deleted from this card at all. Being off the shop and being
 * removable are unrelated: a paused product with no sales history deletes like any other.
 *
 * Delete stays refused for a product with a past. Sale lines name no product of their own, so
 * removing one would leave a past order unable to say what was in it, and the API answers 409 with
 * a sentence worth showing verbatim.
 *
 * Renders nothing for anyone but the super admin. Hidden rather than disabled: a greyed-out delete
 * box invites "why can't I?", and the answer is not a fixable state. The API refuses independently.
 */
export function DeleteProductCard({ productId }: { productId: string }) {
  const router = useRouter();
  const toast = useToast();
  const role = useStaffRole();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const armed = isDeleteConfirmed(confirm);

  if (!role || !canDeleteProduct(role)) return null;

  async function onDelete() {
    if (!armed || busy) return;
    setBusy(true);
    try {
      await deleteProductForever(productId);
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
          Removes this product completely. Only possible if it has never been sold — if it has, take
          it off the shop with <strong>Live on AirPlus</strong> instead, which keeps everything.
          This cannot be undone: type <strong>DELETE</strong> to confirm.
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

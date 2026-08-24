"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { canDeleteProduct } from "@l-shopee/core";
import { inputS } from "@/lib/inputStyles";
import { deleteProductForever, setProductArchived } from "@/lib/api";
import { isDeleteConfirmed } from "@/lib/deleteConfirm";
import { useStaffRole } from "../StaffRoleProvider";
import { useToast } from "../ToastProvider";

/**
 * The two ways a product leaves the shop, in one place, side by side so the difference is legible.
 *
 * The owner separated these on 2026-08-24 — before that both words meant the same thing and the
 * table said "Archive" for what this page called "Delete":
 *
 *   Archive — not live. Everything is kept and it can be undone. What a product with a past gets.
 *   Delete  — gone from the system. Only possible while the product has no history, because the
 *             rows that record a sale name no product of their own; the API refuses the rest.
 *
 * Renders nothing for anyone but the super admin. Hidden rather than disabled: a greyed-out delete
 * box invites "why can't I?", and the answer is not a fixable state. The API refuses independently.
 */
export function DeleteProductCard({ productId, status }: { productId: string; status?: string }) {
  const router = useRouter();
  const toast = useToast();
  const role = useStaffRole();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const armed = isDeleteConfirmed(confirm);
  const archived = status === "archived";

  if (!role || !canDeleteProduct(role)) return null;

  async function run(work: () => Promise<void>, done: string, back?: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      toast(done, "success");
      if (back) router.push("/products");
      else router.refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="danger-zone">
      <div>
        <div className="danger-zone-title">
          {archived ? "Archived product" : "Remove from shop"}
        </div>
        <p className="danger-zone-text">
          {archived
            ? "This product is archived — customers cannot see it, but nothing has been lost. Restore it to put it back as a draft."
            : "Archiving hides this product from the shop and keeps everything, including its sales history. Deleting removes it completely, and is only possible if it has never been sold."}
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn-sm"
          disabled={busy}
          onClick={() =>
            run(
              () => setProductArchived(productId, !archived),
              archived ? "Product restored as a draft" : "Product archived",
            )
          }
        >
          {archived ? "Restore as draft" : "Archive"}
        </button>
      </div>

      {!archived && (
        <div>
          <p className="danger-zone-text">
            Or delete it for good. This cannot be undone — type <strong>DELETE</strong> to confirm.
          </p>
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
              onClick={() => run(() => deleteProductForever(productId), "Product deleted", true)}
            >
              Delete product
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

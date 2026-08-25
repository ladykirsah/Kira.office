"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { canDeleteProduct, canWrite } from "@l-shopee/core";
import { setProductPaused, setProductShopeeListed } from "@/lib/api";
import { channelActionLabel } from "@/lib/channelActions";
import { useStaffRole } from "../StaffRoleProvider";
import { useToast } from "../ToastProvider";
import { useT } from "../LangProvider";

/**
 * Per-row t({ th: "จัดการ ▾", en: "Actions ▾" }) menu: edit the product, or take it off one sales channel.
 *
 * THE TWO CHANNELS PAUSE INDEPENDENTLY, which is why this is two items and not one:
 *
 *   AirPlus — real. The storefront gates on status = 'active', so this genuinely removes the
 *             product from the shop and puts it back.
 *   Shopee  — bookkeeping. There is no Shopee connection; the flag drives the dashboard's MANUAL
 *             "Update on Shopee" worklist and the Not-listed pill. Pausing it on Shopee itself is
 *             still done by hand there. The owner chose the symmetric wording anyway, after being
 *             told — so this menu item reads like the AirPlus one but does less. Do not let that
 *             wording mislead a future change into thinking a Shopee API call happens here.
 *
 * A DRAFT gets the AirPlus item too, reading "Live on AirPlus" — publishing (owner, 2026-08-24).
 * Hiding it was the reason "Active on Shopee" on the edit page had to double as a publish button,
 * which is how turning Shopee on came to put a product in front of AirPlus customers without saying
 * so. With one honest way to publish here, that side effect could be removed.
 *
 * Both are super-admin only, like pausing and deleting from the product page — taking a product off
 * a sales channel is the owner's call. The API refuses independently; this only hides the control.
 */
export function ActionsMenu({
  productId,
  status,
  shopeeListed,
}: {
  productId: string;
  status: string;
  shopeeListed: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const toast = useToast();
  const role = useStaffRole();

  const mayChangeChannels = !!role && canDeleteProduct(role);
  // A mechanic reads the catalog and edits nothing (owner, 2026-08-24), so the menu offers View —
  // the row already links there, but a menu with one dead item would be worse than one that works.
  const mayEdit = !!role && canWrite(role, "products");
  // Live on AirPlus is exactly "the storefront shows it" — status === 'active'. Draft and paused are
  // both simply not-live, and the action for both is the same: make it live.
  const liveOnAirPlus = status === "active";
  const listed = shopeeListed === 1;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function run(work: () => Promise<void>, done: string) {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      toast(done, "success");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="actions-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {t({ th: "จัดการ", en: "Actions" })}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .12s" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="actions-menu" role="menu">
          {mayEdit ? (
            <a className="actions-item" role="menuitem" href={`/products/${productId}/edit?edit=1`}>
              {t({ th: "แก้ไข", en: "Edit" })}
            </a>
          ) : (
            <a className="actions-item" role="menuitem" href={`/products/${productId}`}>
              {t({ th: "ดู", en: "View" })}
            </a>
          )}

          {mayChangeChannels && (
            <button
              type="button"
              className="actions-item"
              role="menuitem"
              disabled={busy}
              onClick={() =>
                run(
                  () => setProductPaused(productId, liveOnAirPlus),
                  liveOnAirPlus
                    ? t({ th: "หยุดขายบน AirPlus", en: "Paused on AirPlus" })
                    : t({ th: "วางขายบน AirPlus", en: "Live on AirPlus" }),
                )
              }
            >
              {t(channelActionLabel("AirPlus", liveOnAirPlus))}
            </button>
          )}

          {mayChangeChannels && (
            <button
              type="button"
              className="actions-item"
              role="menuitem"
              disabled={busy}
              onClick={() =>
                run(
                  () => setProductShopeeListed(productId, !listed),
                  listed
                    ? t({ th: "หยุดขายบน Shopee", en: "Paused on Shopee" })
                    : t({ th: "วางขายบน Shopee", en: "Live on Shopee" }),
                )
              }
            >
              {t(channelActionLabel("Shopee", listed))}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { adjustStock } from "@/lib/api";
import { useToast } from "../ToastProvider";
import { useT } from "../LangProvider";

const Pencil = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const Check = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const wrap = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  justifyContent: "center",
} as const;

// Editing lays out the input + save icon on one line; only when the column is too narrow to
// fit both does the icon wrap below (flex-wrap), so wide columns keep the normal inline look.
const editWrap = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
} as const;

/**
 * Inline stock editor: number + pencil → input + check (saves a ledger adjustment for the delta).
 * The number is SELLABLE stock; when a hold is active it also shows the held count, so a stocktake
 * here is never entered as the physical total (which would inflate sellable and oversell). Held
 * stock is moved via Scan here › On hold, not this field.
 */
export function StockCell({
  variantId,
  onHand,
  held = 0,
  readOnly = false,
}: {
  variantId: string | null;
  onHand: number;
  held?: number;
  /** A mechanic reads the catalog; the count still shows, the pencil does not (owner, 2026-08-24). */
  readOnly?: boolean;
}) {
  const t = useT();
  const toast = useToast();
  const [current, setCurrent] = useState(onHand);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(onHand));
  const [busy, setBusy] = useState(false);

  function startEdit() {
    setValue(String(current));
    setEditing(true);
  }

  async function save() {
    const target = Math.round(parseFloat(value));
    if (!variantId || !Number.isFinite(target) || target === current) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      // Send the typed number, not `target - current`: `current` is from the last table load and
      // may be stale, which would land the edit on the wrong on-hand.
      const res = await adjustStock({
        productVariantId: variantId,
        countedOnHand: target,
        movementType: "manual_adjustment",
        reason: "edited from products table",
      });
      if (res.applied) {
        setCurrent(res.quantityAfter);
        setEditing(false);
      } else {
        toast(res.reason ?? t({ th: "สต็อกไม่เปลี่ยน", en: "Stock not changed" }), "error");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <span style={editWrap}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          autoFocus
          className="stock-input"
          disabled={busy}
          title={
            held > 0
              ? t({
                  th: `จำนวนที่ขายได้ — กันไว้ ${held} ชิ้น นับแยกต่างหาก`,
                  en: `Sellable count — ${held} on hold is separate`,
                })
              : undefined
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            else if (e.key === "Escape") setEditing(false);
          }}
          style={{ width: 44, textAlign: "right", minHeight: 0, padding: "4px 6px" }}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label={t({ th: "บันทึกสต็อก", en: "Save stock" })}
          title={t({ th: "บันทึก", en: "Save" })}
          disabled={busy}
          onClick={save}
          style={{ color: "var(--ok)" }}
        >
          <Check />
        </button>
      </span>
    );
  }

  return (
    <span style={wrap}>
      <span>{current}</span>
      {held > 0 && (
        <span
          className="muted"
          title={t({
            th: `กันไว้ ${held} ชิ้น — ไม่ได้ขาย`,
            en: `${held} on hold — paused, not for sale`,
          })}
          style={{ fontSize: 11, whiteSpace: "nowrap" }}
        >
          +{held} {t({ th: "กันไว้", en: "held" })}
        </span>
      )}
      {!readOnly && (
        <button
          type="button"
          className="icon-btn"
          aria-label={t({ th: "แก้ไขสต็อก", en: t({ th: "แก้ไขสต็อก", en: "Edit stock" }) })}
          title={t({ th: "แก้ไขสต็อก", en: "Edit stock" })}
          onClick={startEdit}
        >
          <Pencil />
        </button>
      )}
    </span>
  );
}

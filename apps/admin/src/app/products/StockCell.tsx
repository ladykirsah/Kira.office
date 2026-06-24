"use client";

import { useState } from "react";
import { adjustStock } from "@/lib/api";
import { useToast } from "../ToastProvider";

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
  justifyContent: "flex-end",
} as const;

/** Inline stock editor: number + pencil → input + check (saves a ledger adjustment for the delta). */
export function StockCell({ variantId, onHand }: { variantId: string | null; onHand: number }) {
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
      const res = await adjustStock({
        productVariantId: variantId,
        quantityDelta: target - current,
        movementType: "manual_adjustment",
        reason: "edited from products table",
      });
      if (res.applied) {
        setCurrent(res.quantityAfter);
        setEditing(false);
      } else {
        toast(res.reason ?? "Stock not changed", "error");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <span style={wrap}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          autoFocus
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            else if (e.key === "Escape") setEditing(false);
          }}
          style={{ width: 60, textAlign: "right", minHeight: 0, padding: "4px 6px" }}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label="Save stock"
          title="Save"
          disabled={busy}
          onClick={save}
          style={{ color: "var(--primary)" }}
        >
          <Check />
        </button>
      </span>
    );
  }

  return (
    <span style={wrap}>
      <span>{current}</span>
      <button
        type="button"
        className="icon-btn"
        aria-label="Edit stock"
        title="Edit stock"
        onClick={startEdit}
      >
        <Pencil />
      </button>
    </span>
  );
}

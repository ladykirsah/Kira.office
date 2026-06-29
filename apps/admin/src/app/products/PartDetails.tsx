"use client";

import type { CSSProperties } from "react";
import type { Attributes } from "@/lib/api";
import { inputL } from "@/lib/inputStyles";
import { Combobox } from "./Combobox";
import { BarcodePreview } from "./BarcodePreview";

export interface PartForm {
  brand: string;
  usage: string;
  type: string;
}

const field: CSSProperties = { display: "grid", gap: 4 };
const names = (opts: { name: string }[] | undefined) => (opts ?? []).map((o) => o.name);

/** Part taxonomy dropdowns + identifiers (Product ID, Shopee ID) for the part. The barcode is the
 *  Product ID — there is no separate barcode field; it's previewed beside the Product ID input. */
export function PartDetails({
  value,
  onChange,
  attributes,
  productRef,
  onProductRefChange,
  shopeeItemId,
  onShopeeItemIdChange,
  refWarning,
  shopeeWarning,
}: {
  value: PartForm;
  onChange: (patch: Partial<PartForm>) => void;
  attributes: Attributes | null;
  productRef: string;
  onProductRefChange: (v: string) => void;
  shopeeItemId: string;
  onShopeeItemIdChange: (v: string) => void;
  /** Optional "already used by …" warnings shown under the matching identifier field. */
  refWarning?: string | null;
  shopeeWarning?: string | null;
}) {
  const warn = (msg: string | null | undefined) =>
    msg ? <small style={{ color: "var(--danger)", fontSize: 12 }}>{msg}</small> : null;

  const composed = [value.brand, value.usage, value.type]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        background: "var(--surface)",
      }}
    >
      <span style={{ fontWeight: 600 }}>Part details</span>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
          gap: 12,
        }}
      >
        <label style={field}>
          Part brand
          <Combobox
            value={value.brand}
            onChange={(v) => onChange({ brand: v })}
            options={names(attributes?.brands)}
            placeholder="e.g. DENSO"
          />
        </label>
        <label style={field}>
          Match car system
          <Combobox
            value={value.usage}
            onChange={(v) => onChange({ usage: v })}
            options={names(attributes?.usages)}
            placeholder="e.g. A/C"
          />
        </label>
        <label style={field}>
          Part name
          <Combobox
            value={value.type}
            onChange={(v) => onChange({ type: v })}
            options={names(attributes?.types)}
            placeholder="e.g. Evaporator"
          />
        </label>
      </div>
      <small className="muted">
        Category: {composed || "—"} · pick from the list or type a new value to add it.
      </small>

      {/* The Product ID is the single identifier — type it, or scan the part's barcode (which encodes
          it). The barcode is created from this value and previewed beside it; there is no separate
          barcode field. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
          alignItems: "center",
        }}
      >
        <label style={field}>
          Product ID
          <input
            value={productRef}
            onChange={(e) => onProductRefChange(e.target.value)}
            onKeyDown={(e) => {
              // A USB scanner ends a scan with Enter — don't let that submit the form.
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="type or scan the part no."
            style={inputL}
          />
          {warn(refWarning)}
          <small className="muted" style={{ fontSize: 12 }}>
            Type it, or scan the part’s barcode — the barcode is created from this.
          </small>
        </label>
        {productRef.trim() ? <BarcodePreview value={productRef.trim()} /> : null}
      </div>

      <label style={field}>
        Shopee ID (link)
        <input
          value={shopeeItemId}
          onChange={(e) => onShopeeItemIdChange(e.target.value)}
          placeholder="Shopee item id"
          style={inputL}
        />
        {warn(shopeeWarning)}
      </label>
    </div>
  );
}

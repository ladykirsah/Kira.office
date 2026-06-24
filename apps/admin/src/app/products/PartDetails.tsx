"use client";

import type { CSSProperties } from "react";
import type { Attributes } from "@/lib/api";
import { Combobox } from "./Combobox";
import { BarcodePreview } from "./BarcodePreview";

export interface PartForm {
  brand: string;
  usage: string;
  type: string;
}

const field: CSSProperties = { display: "grid", gap: 4 };
const names = (opts: { name: string }[] | undefined) => (opts ?? []).map((o) => o.name);

/** Part taxonomy dropdowns + identifiers (Product ID, barcode, Shopee ID) for the part. */
export function PartDetails({
  value,
  onChange,
  attributes,
  barcode,
  onBarcodeChange,
  productRef,
  onProductRefChange,
  shopeeItemId,
  onShopeeItemIdChange,
  refWarning,
  barcodeWarning,
  shopeeWarning,
}: {
  value: PartForm;
  onChange: (patch: Partial<PartForm>) => void;
  attributes: Attributes | null;
  barcode: string;
  onBarcodeChange: (v: string) => void;
  productRef: string;
  onProductRefChange: (v: string) => void;
  shopeeItemId: string;
  onShopeeItemIdChange: (v: string) => void;
  /** Optional "already used by …" warnings shown under the matching identifier field. */
  refWarning?: string | null;
  barcodeWarning?: string | null;
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

      <label style={field}>
        Product ID
        <input
          value={productRef}
          onChange={(e) => onProductRefChange(e.target.value)}
          placeholder="catalog / part no. (comes with the product)"
        />
        {warn(refWarning)}
      </label>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
          alignItems: "center",
        }}
      >
        <label style={field}>
          Barcode
          <input
            value={barcode}
            onChange={(e) => onBarcodeChange(e.target.value)}
            placeholder="scan / type"
          />
          {warn(barcodeWarning)}
        </label>
        {/* A barcode already used by another product can't be reused — hide its preview. */}
        {barcodeWarning ? null : <BarcodePreview value={barcode} />}
      </div>

      <label style={field}>
        Shopee ID (link)
        <input
          value={shopeeItemId}
          onChange={(e) => onShopeeItemIdChange(e.target.value)}
          placeholder="Shopee item id"
        />
        {warn(shopeeWarning)}
      </label>
    </div>
  );
}

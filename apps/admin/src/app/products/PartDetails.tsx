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

/** Barcode + three creatable dropdowns (pick from the list or type a new value) for the part. */
export function PartDetails({
  value,
  onChange,
  attributes,
  barcode,
  onBarcodeChange,
}: {
  value: PartForm;
  onChange: (patch: Partial<PartForm>) => void;
  attributes: Attributes | null;
  barcode: string;
  onBarcodeChange: (v: string) => void;
}) {
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
        Barcode
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input
            value={barcode}
            onChange={(e) => onBarcodeChange(e.target.value)}
            placeholder="scan / type"
            style={{ flex: 1, minWidth: 0 }}
          />
          <BarcodePreview value={barcode} />
        </div>
      </label>
    </div>
  );
}

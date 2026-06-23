"use client";

import type { CSSProperties } from "react";
import type { Attributes, AttrOption } from "@/lib/api";

export interface PartForm {
  brand: string;
  usage: string;
  type: string;
}

const field: CSSProperties = { display: "grid", gap: 4 };

function options(id: string, opts: AttrOption[]) {
  return (
    <datalist id={id}>
      {opts.map((o) => (
        <option key={o.id} value={o.name} />
      ))}
    </datalist>
  );
}

/** Three creatable dropdowns (pick from the list or type a new value) for the car-part taxonomy. */
export function PartDetails({
  value,
  onChange,
  attributes,
}: {
  value: PartForm;
  onChange: (patch: Partial<PartForm>) => void;
  attributes: Attributes | null;
}) {
  const composed = [value.brand, value.usage, value.type]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={{ display: "grid", gap: 6 }}>
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
          <input
            list="opt-brands"
            value={value.brand}
            onChange={(e) => onChange({ brand: e.target.value })}
            placeholder="e.g. DENSO"
          />
        </label>
        <label style={field}>
          Match car system
          <input
            list="opt-usages"
            value={value.usage}
            onChange={(e) => onChange({ usage: e.target.value })}
            placeholder="e.g. A/C"
          />
        </label>
        <label style={field}>
          Part name
          <input
            list="opt-types"
            value={value.type}
            onChange={(e) => onChange({ type: e.target.value })}
            placeholder="e.g. Evaporator"
          />
        </label>
      </div>
      {options("opt-brands", attributes?.brands ?? [])}
      {options("opt-usages", attributes?.usages ?? [])}
      {options("opt-types", attributes?.types ?? [])}
      <small className="muted">
        Category: {composed || "—"} · pick from the list or type a new value to add it.
      </small>
    </div>
  );
}

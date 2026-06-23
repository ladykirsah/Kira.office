"use client";

import { Fragment, type ReactNode } from "react";
import type { CarModelNode } from "@/lib/api";

/** Read-only display of a car model's service notes, with an Edit button to switch to the form. */
export function ModelInfoView({ model, onEdit }: { model: CarModelNode; onEdit: () => void }) {
  // Note: the era (year range) is shown as a chip on the model's row header, so it's omitted here.
  const rows: { label: string; value: ReactNode }[] = [];
  if (model.generationCode)
    rows.push({ label: "Generation / chassis", value: model.generationCode });
  if (model.refrigerant) rows.push({ label: "Refrigerant", value: model.refrigerant });
  if (model.coolantLiters) rows.push({ label: "Coolant (liters)", value: model.coolantLiters });
  if (model.oringUsage?.length) {
    rows.push({
      label: "O-ring usage",
      value: (
        <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {model.oringUsage.map((e, i) => (
            <span className="oring-chip" key={i}>
              {e.size} ×{e.qty}
            </span>
          ))}
        </span>
      ),
    });
  }
  if (model.notes) rows.push({ label: "Notes", value: model.notes });

  return (
    <div className="md-minfo">
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: "2px 0 14px", fontSize: 14 }}>
          No service notes yet.
        </p>
      ) : (
        <div className="md-view">
          {rows.map((r) => (
            <Fragment key={r.label}>
              <span className="md-view-l">{r.label}</span>
              <span className="md-view-v">{r.value}</span>
            </Fragment>
          ))}
        </div>
      )}
      <button type="button" className="btn-soft" onClick={onEdit} style={{ marginTop: 14 }}>
        Edit
      </button>
    </div>
  );
}

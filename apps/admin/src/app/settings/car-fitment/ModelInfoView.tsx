"use client";

import { Fragment, useState, type ReactNode } from "react";
import type { CarModelNode } from "@/lib/api";
import { ConfirmButton } from "../../ConfirmButton";
import { useT } from "../../LangProvider";

/** Read-only display of a car model's service notes, with Edit + Remove actions. */
export function ModelInfoView({
  model,
  onEdit,
  onRemove,
}: {
  model: CarModelNode;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [removing, setRemoving] = useState(false); // delete armed → hide Edit, show only Remove/Cancel
  // Note: the era (year range) is shown as a chip on the model's row header, so it's omitted here.
  const rows: { label: string; value: ReactNode }[] = [];
  if (model.oringUsage?.length) {
    rows.push({
      label: t({ th: "โอริงที่ใช้", en: "O-ring usage" }),
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
  if (model.notes) rows.push({ label: t({ th: "บันทึก", en: "Notes" }), value: model.notes });

  return (
    <div className="md-minfo">
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: "2px 0 14px", fontSize: 14 }}>
          {t({ th: "ยังไม่มีข้อมูลบริการ", en: "No service notes yet." })}
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
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {!removing && (
          <button type="button" className="btn-primary btn-sm" onClick={onEdit}>
            {t({ th: "แก้ไข", en: "Edit" })}
          </button>
        )}
        <ConfirmButton
          className="btn-sm"
          ariaLabel={t({ th: `ลบ ${model.name}`, en: `Remove ${model.name}` })}
          confirmLabel={t({ th: "ลบรุ่นนี้?", en: "Remove model?" })}
          onConfirm={onRemove}
          onArmedChange={setRemoving}
        >
          {t({ th: "ลบ", en: "Remove" })}
        </ConfirmButton>
      </div>
    </div>
  );
}

"use client";

import { Combobox } from "./Combobox";
import type { Fitment } from "@/lib/api";

const toYear = (s: string): number | null => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

/** "Fits these cars" frame — one row per compatible vehicle (brand, model, year range). */
export function FitmentSection({
  fitments,
  onChange,
  carBrands,
  carModels,
}: {
  fitments: Fitment[];
  onChange: (next: Fitment[]) => void;
  carBrands: string[];
  carModels: string[];
}) {
  const patch = (i: number, p: Partial<Fitment>) =>
    onChange(fitments.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const add = () =>
    onChange([...fitments, { carBrand: "", carModel: "", yearFrom: null, yearTo: null }]);
  const remove = (i: number) => onChange(fitments.filter((_, j) => j !== i));

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        background: "var(--surface)",
      }}
    >
      <span style={{ fontWeight: 600 }}>Fits these cars</span>
      <small className="muted" style={{ marginTop: -4 }}>
        One part can fit several vehicles — add each compatible car and its year range.
      </small>
      <table className="ftbl">
        <colgroup>
          <col style={{ width: "28%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "34%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Car brand</th>
            <th>Model</th>
            <th>Years</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {fitments.length === 0 && (
            <tr>
              <td colSpan={4} className="muted" style={{ textAlign: "left" }}>
                No cars yet — add one below.
              </td>
            </tr>
          )}
          {fitments.map((f, i) => (
            <tr key={i}>
              <td>
                <Combobox
                  value={f.carBrand ?? ""}
                  onChange={(v) => patch(i, { carBrand: v })}
                  options={carBrands}
                  placeholder="e.g. Toyota"
                />
              </td>
              <td>
                <Combobox
                  value={f.carModel ?? ""}
                  onChange={(v) => patch(i, { carModel: v })}
                  options={carModels}
                  placeholder="e.g. Vios"
                />
              </td>
              <td>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    value={f.yearFrom ?? ""}
                    onChange={(e) => patch(i, { yearFrom: toYear(e.target.value) })}
                    placeholder="from"
                    inputMode="numeric"
                    style={{ width: "min(64px, 100%)" }}
                  />
                  <span className="muted">–</span>
                  <input
                    value={f.yearTo ?? ""}
                    onChange={(e) => patch(i, { yearTo: toYear(e.target.value) })}
                    placeholder="to"
                    inputMode="numeric"
                    style={{ width: "min(64px, 100%)" }}
                  />
                </span>
              </td>
              <td>
                <button
                  type="button"
                  className="icon-del"
                  aria-label="Remove car"
                  onClick={() => remove(i)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 7h16" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={add} style={{ justifySelf: "start", marginTop: 4 }}>
        + Add car
      </button>
    </div>
  );
}

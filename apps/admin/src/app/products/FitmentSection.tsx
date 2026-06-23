"use client";

import { Combobox } from "./Combobox";
import { FitmentModelPicker, type Generation } from "./FitmentModelPicker";
import type { Fitment, CarBrandTree } from "@/lib/api";

/** "Fits these cars" frame — one row per compatible vehicle generation (brand + model · era). */
export function FitmentSection({
  fitments,
  onChange,
  carTree,
}: {
  fitments: Fitment[];
  onChange: (next: Fitment[]) => void;
  carTree: CarBrandTree[];
}) {
  const patch = (i: number, p: Partial<Fitment>) =>
    onChange(fitments.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const add = () =>
    onChange([...fitments, { carBrand: "", carModel: "", yearFrom: null, yearTo: null }]);
  const remove = (i: number) => onChange(fitments.filter((_, j) => j !== i));

  const brandNames = carTree.map((b) => b.name);
  const brandOf = (brand: string | null) =>
    carTree.find((x) => x.name.toLowerCase() === (brand ?? "").trim().toLowerCase());
  // Every registered generation for the brand — each (name + era) is its own pickable option.
  const gensFor = (brand: string | null): Generation[] => {
    const b = brandOf(brand);
    return b ? b.models.map((m) => ({ name: m.name, from: m.yearFrom, to: m.yearTo })) : [];
  };

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
        One part can fit several vehicles — add each compatible model. If it fits two generations of
        the same model, add a row for each.
      </small>
      <table className="ftbl">
        <colgroup>
          <col style={{ width: "36%" }} />
          <col style={{ width: "54%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Car brand</th>
            <th>Model</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {fitments.length === 0 && (
            <tr>
              <td colSpan={3} className="muted" style={{ textAlign: "left" }}>
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
                  options={brandNames}
                  placeholder="e.g. Toyota"
                />
              </td>
              <td>
                <FitmentModelPicker
                  value={f}
                  options={gensFor(f.carBrand)}
                  onPick={(g) => patch(i, { carModel: g.name, yearFrom: g.from, yearTo: g.to })}
                  placeholder="e.g. Vios · 2007 – 2013"
                />
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

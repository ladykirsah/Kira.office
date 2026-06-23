"use client";

import { Combobox } from "./Combobox";
import type { Fitment, CarBrandTree } from "@/lib/api";

const toYear = (s: string): number | null => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

/** "Fits these cars" frame — one row per compatible vehicle (brand, model, year range). */
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
  // Model names are deduped — the same name can have several eras (generations).
  const modelsFor = (brand: string | null) => {
    const b = brandOf(brand);
    return b ? [...new Set(b.models.map((m) => m.name))] : [];
  };
  // The year ranges (eras) registered for a given model — offered as quick-fill chips.
  const erasFor = (brand: string | null, model: string | null) => {
    const b = brandOf(brand);
    const name = (model ?? "").trim().toLowerCase();
    if (!b || !name) return [];
    const seen = new Set<string>();
    const out: { from: number | null; to: number | null }[] = [];
    for (const m of b.models) {
      if (m.name.toLowerCase() !== name) continue;
      if (m.yearFrom == null && m.yearTo == null) continue;
      const key = `${m.yearFrom ?? ""}-${m.yearTo ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ from: m.yearFrom, to: m.yearTo });
    }
    return out.sort((a, b2) => (a.from ?? 0) - (b2.from ?? 0));
  };
  const eraLabel = (e: { from: number | null; to: number | null }) =>
    e.from && e.to ? `${e.from} – ${e.to}` : e.from ? `${e.from}+` : `– ${e.to}`;

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
                  options={brandNames}
                  placeholder="e.g. Toyota"
                />
              </td>
              <td>
                <Combobox
                  value={f.carModel ?? ""}
                  onChange={(v) => patch(i, { carModel: v })}
                  options={modelsFor(f.carBrand)}
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
                {erasFor(f.carBrand, f.carModel).length > 0 && (
                  <span
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      marginTop: 5,
                      justifyContent: "flex-start",
                    }}
                  >
                    {erasFor(f.carBrand, f.carModel).map((e, k) => (
                      <button
                        key={k}
                        type="button"
                        className="era-chip"
                        title="Use this generation's years"
                        onClick={() => patch(i, { yearFrom: e.from, yearTo: e.to })}
                      >
                        {eraLabel(e)}
                      </button>
                    ))}
                  </span>
                )}
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

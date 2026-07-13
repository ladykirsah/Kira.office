"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Product filter (owner-approved "Design 1"): a "ตัวกรอง" button that opens a bottom sheet with the
 * car-fitment cascade (ยี่ห้อ → รุ่น → ปี), a product category chip group, and a product brand chip
 * group — both led by a "ทั้งหมด" (no-filter) chip. Apply writes the selections to the /products
 * query string and the server re-queries; the button shows a badge with the active-filter count.
 * The car year is a fixed list matched against each fitment's year_from..year_to server-side.
 */

interface FilterProps {
  fitments: { brand: string; models: string[] }[];
  types: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  current: {
    q?: string;
    carBrand?: string;
    carModel?: string;
    year?: string;
    type?: string;
    brand?: string;
    ctx?: string;
  };
}

const YEARS = Array.from({ length: 27 }, (_, i) => 2026 - i); // 2026 → 2000

export function ProductFilter({ fitments, types, brands, current }: FilterProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [carBrand, setCarBrand] = useState("");
  const [carModel, setCarModel] = useState("");
  const [year, setYear] = useState("");
  const [typeId, setTypeId] = useState("");
  const [brandId, setBrandId] = useState("");

  const activeCount = [
    current.carBrand,
    current.carModel,
    current.year,
    current.type,
    current.brand,
  ].filter(Boolean).length;

  const models = fitments.find((f) => f.brand === carBrand)?.models ?? [];

  function openSheet() {
    // seed the pending selections from the currently-applied URL filters
    setCarBrand(current.carBrand ?? "");
    setCarModel(current.carModel ?? "");
    setYear(current.year ?? "");
    setTypeId(current.type ?? "");
    setBrandId(current.brand ?? "");
    setOpen(true);
  }

  function clearAll() {
    setCarBrand("");
    setCarModel("");
    setYear("");
    setTypeId("");
    setBrandId("");
  }

  function apply() {
    const p = new URLSearchParams();
    if (current.q) p.set("q", current.q); // keep an active search
    if (current.ctx) p.set("ctx", current.ctx); // keep the browse context (Categories / By Brand)
    if (carBrand) p.set("carBrand", carBrand);
    if (carBrand && carModel) p.set("carModel", carModel);
    if (year) p.set("year", year);
    if (typeId) p.set("type", typeId);
    if (brandId) p.set("brand", brandId);
    const qs = p.toString();
    // Re-filtering the page we're already on — REPLACE (not push) so each filter change overwrites
    // the current history entry instead of stacking a new one. The back arrow then returns to the
    // previous PAGE (home/category), never a prior filter state the shopper didn't navigate to.
    router.replace(qs ? `/products?${qs}` : "/products");
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="filter-btn" onClick={openSheet}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="17" x2="20" y2="17" />
          <circle cx="15" cy="7" r="2.4" fill="var(--white)" />
          <circle cx="9" cy="17" r="2.4" fill="var(--white)" />
        </svg>
        ตัวกรอง
        {activeCount > 0 && <span className="fbadge">{activeCount}</span>}
      </button>

      {open && (
        <div className="filter-overlay" onClick={() => setOpen(false)}>
          <div
            className="filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="ตัวกรองสินค้า"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="filter-grab" aria-hidden="true" />
            <div className="filter-top">
              <b>ตัวกรอง</b>
              <button
                type="button"
                className="filter-x"
                aria-label="ปิด"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="filter-grp">
              <div className="filter-seclbl">🚗 รถของคุณ</div>
              <div className="filter-cascade">
                <select
                  className="filter-sel"
                  aria-label="ยี่ห้อรถ"
                  value={carBrand}
                  onChange={(e) => {
                    setCarBrand(e.target.value);
                    setCarModel(""); // models depend on the brand
                  }}
                >
                  <option value="">ยี่ห้อรถ — ทั้งหมด</option>
                  {fitments.map((f) => (
                    <option key={f.brand} value={f.brand}>
                      {f.brand}
                    </option>
                  ))}
                </select>
                <select
                  className="filter-sel"
                  aria-label="รุ่น"
                  value={carModel}
                  disabled={!carBrand}
                  onChange={(e) => setCarModel(e.target.value)}
                >
                  <option value="">{carBrand ? "รุ่น — ทั้งหมด" : "เลือกยี่ห้อก่อน"}</option>
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  className="filter-sel"
                  aria-label="ปี"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">ปี — ทั้งหมด</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filter-grp">
              <div className="filter-seclbl">📦 หมวดหมู่</div>
              <div className="filter-chips">
                <button
                  type="button"
                  className={typeId ? "chip" : "chip on"}
                  onClick={() => setTypeId("")}
                >
                  ทั้งหมด
                </button>
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={typeId === t.id ? "chip on" : "chip"}
                    onClick={() => setTypeId(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-grp">
              <div className="filter-seclbl">🏷️ แบรนด์</div>
              <div className="filter-chips">
                <button
                  type="button"
                  className={brandId ? "chip" : "chip on"}
                  onClick={() => setBrandId("")}
                >
                  ทั้งหมด
                </button>
                {brands.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={brandId === b.id ? "chip on" : "chip"}
                    onClick={() => setBrandId(b.id)}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-actions">
              <button type="button" className="filter-clear" onClick={clearAll}>
                ล้าง
              </button>
              <button type="button" className="filter-apply" onClick={apply}>
                ดูสินค้า
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

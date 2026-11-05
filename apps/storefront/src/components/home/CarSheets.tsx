"use client";

import { useEffect, useState } from "react";
import type { CarModelOption } from "@/lib/db";
import { carName, eraLabel, yearChoices, type MyCar } from "@/lib/myCar";
import { Icon } from "@/components/Icon";
import { useMyCar } from "./MyCarProvider";

export interface CarBrandOption {
  brand: string;
  nameTh: string | null;
  /** resolved logo URL (lib/brandLogo — the owner's upload wins); null → car icon */
  logo: string | null;
  productCount: number;
}

type Step = "brand" | "model" | "year";

/** A car brand's real logo filling its round frame (a picture is its frame). */
export function BrandLogo({ src, size }: { src: string | null; size: number }) {
  if (!src) {
    return (
      <span className="hm-logo hm-logo--none" style={{ width: size, height: size }}>
        <Icon name="car" size={Math.round(size * 0.5)} />
      </span>
    );
  }
  return <img className="hm-logo" src={src} alt="" width={size} height={size} />;
}

/** Bottom sheet: ยกเลิก / ‹ back pill on the left, title in the middle, red ✓ on the right. */
export function Sheet({
  title,
  sub,
  left,
  onLeft,
  onDim,
  onOk,
  tall = false,
  children,
}: {
  title: string;
  sub?: string;
  left: string;
  onLeft: () => void;
  /** tapping outside the sheet; defaults to the left pill (ตัวกรอง's ล้าง clears, it doesn't close) */
  onDim?: () => void;
  onOk?: () => void;
  /** the brand › model › year steps fill the screen (drawing 1.2–1.4); รถของฉัน fits its rows */
  tall?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="hm-sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="hm-dim" aria-label="ปิด" onClick={onDim ?? onLeft} />
      <div className={tall ? "hm-sheet hm-sheet--tall" : "hm-sheet"}>
        <div className="hm-sheet-head">
          <button type="button" className="hm-pill" onClick={onLeft}>
            {left}
          </button>
          <div className="hm-sheet-title">
            <b>{title}</b>
            {sub && <span>{sub}</span>}
          </div>
          {onOk ? (
            <button type="button" className="hm-ok" aria-label="ยืนยัน" onClick={onOk}>
              <Icon name="check" size={18} />
            </button>
          ) : (
            <span />
          )}
        </div>
        <div className="hm-sheet-body">{children}</div>
      </div>
    </div>
  );
}

function SearchRow({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="hm-sheet-search">
      <Icon name="search" size={18} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}

/** 1.2 → 1.3 → 1.4: pick brand › model › year. */
export function CarPicker({
  brands,
  models,
  onClose,
}: {
  brands: CarBrandOption[];
  models: CarModelOption[];
  onClose: () => void;
}) {
  const { saveCar } = useMyCar();
  const [step, setStep] = useState<Step>("brand");
  const [brand, setBrand] = useState<CarBrandOption | null>(null);
  const [model, setModel] = useState<CarModelOption | null>(null);
  const [year, setYear] = useState<number | null | undefined>(undefined);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  if (step === "brand") {
    const list = brands.filter(
      (b) => !query || b.brand.toLowerCase().includes(query) || (b.nameTh ?? "").includes(q.trim()),
    );
    return (
      <Sheet title="เลือกยี่ห้อรถ" sub="ขั้น 1 จาก 3" left="ยกเลิก" onLeft={onClose} tall>
        <SearchRow value={q} onChange={setQ} placeholder="ค้นหายี่ห้อ" />
        <div className="hm-list">
          {list.map((b) => (
            <button
              key={b.brand}
              type="button"
              className="hm-row"
              onClick={() => {
                setBrand(b);
                setQ("");
                setStep("model");
              }}
            >
              <BrandLogo src={b.logo} size={32} />
              <span className="hm-row-main">
                {b.brand}
                {b.nameTh && <span className="hm-muted"> {b.nameTh}</span>}
              </span>
              <span className="hm-row-end">{b.productCount} รายการ</span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  if (step === "model" && brand) {
    const list = models.filter(
      (m) => m.brand === brand.brand && (!query || m.model.toLowerCase().includes(query)),
    );
    return (
      <Sheet
        title={brand.brand}
        sub="ขั้น 2 จาก 3 · เลือกรุ่น"
        left="‹ ยี่ห้อ"
        onLeft={() => setStep("brand")}
        tall
      >
        <SearchRow value={q} onChange={setQ} placeholder="ค้นหารุ่น" />
        <div className="hm-list">
          {list.length === 0 && <p className="hm-empty">ยังไม่มีรุ่นของยี่ห้อนี้</p>}
          {list.map((m) => (
            <button
              key={`${m.model}-${m.yearFrom}-${m.yearTo}`}
              type="button"
              className="hm-row"
              onClick={() => {
                setModel(m);
                setYear(undefined);
                setQ("");
                setStep("year");
              }}
            >
              <span className="hm-row-main">
                {m.model} <span className="hm-muted">{eraLabel(m.yearFrom, m.yearTo)}</span>
              </span>
              <span className="hm-row-end">{m.productCount} รายการ</span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  if (step === "year" && brand && model) {
    const years = yearChoices(model.yearFrom, model.yearTo, new Date().getFullYear()).filter(
      (y) => !query || String(y).includes(query),
    );
    const done = () => {
      if (year === undefined) return;
      const car: MyCar = {
        brand: brand.brand,
        model: model.model,
        yearFrom: model.yearFrom,
        yearTo: model.yearTo,
        year,
      };
      saveCar(car);
      onClose();
    };
    return (
      <Sheet
        title={`${brand.brand} ${model.model}`}
        sub="ขั้น 3 จาก 3 · เลือกปี"
        left="‹ รุ่น"
        onLeft={() => setStep("model")}
        onOk={year === undefined ? undefined : done}
        tall
      >
        <SearchRow value={q} onChange={setQ} placeholder="ค้นหาปี" />
        <div className="hm-list">
          {!query && (
            <button
              type="button"
              className="hm-row"
              aria-pressed={year === null}
              onClick={() => setYear(null)}
            >
              <span className="hm-row-main">ไม่ทราบปี</span>
              {year === null && <Icon name="check" size={18} />}
            </button>
          )}
          {years.map((y) => (
            <button
              key={y}
              type="button"
              className="hm-row"
              aria-pressed={year === y}
              onClick={() => setYear(y)}
            >
              <span className="hm-row-main">{y}</span>
              {year === y && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>
      </Sheet>
    );
  }
  return null;
}

/** 1.6: the saved car · เลือกรถคันอื่น · เอารถออก. */
export function MyCarSheet({
  car,
  logo,
  onClose,
  onPickOther,
}: {
  car: MyCar;
  logo: string | null;
  onClose: () => void;
  onPickOther: () => void;
}) {
  const { clearCar } = useMyCar();
  return (
    <Sheet title="รถของฉัน" left="ยกเลิก" onLeft={onClose}>
      <div className="hm-list">
        <div className="hm-row">
          <BrandLogo src={logo} size={32} />
          <span className="hm-row-main hm-row-two">
            {carName(car)}
            <span className="hm-muted">{car.year === null ? "ไม่ทราบปี" : `ปี ${car.year}`}</span>
          </span>
          <span className="hm-red">
            <Icon name="check" size={18} />
          </span>
        </div>
        <button type="button" className="hm-row" onClick={onPickOther}>
          <span className="hm-row-main">เลือกรถคันอื่น</span>
          <Icon name="chevron" size={16} />
        </button>
        <button
          type="button"
          className="hm-row hm-red"
          onClick={() => {
            clearCar();
            onClose();
          }}
        >
          <span className="hm-row-main">เอารถออก</span>
        </button>
      </div>
    </Sheet>
  );
}

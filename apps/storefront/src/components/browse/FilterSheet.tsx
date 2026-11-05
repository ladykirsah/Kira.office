"use client";

import { useEffect, useRef, useState } from "react";
import type { CarModelOption } from "@/lib/db";
import type { CategoryRow } from "@/lib/groupBySystem";
import { imgUrl } from "@/lib/img";
import { carName } from "@/lib/myCar";
import { Icon } from "@/components/Icon";
import { BrandLogo, CarPicker, Sheet, type CarBrandOption } from "@/components/home/CarSheets";
import { useMyCar } from "@/components/home/MyCarProvider";

export interface FilterChoice {
  carOn: boolean;
  type?: string;
  brand?: string;
}

/** A pick-list row: ✓ on the chosen one, no › (a tap picks, it opens nothing). */
function PickRow({
  on,
  onPick,
  children,
}: {
  on: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="hm-row" aria-pressed={on} onClick={onPick}>
      {children}
      {on ? (
        <Icon name="check" size={20} />
      ) : (
        <span style={{ width: 20, flex: "0 0 auto" }} aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * ตัวกรอง = C (owner's pick, 5 Nov 2026): white rows that tell what is chosen — รถของคุณ (logo beside
 * the car, same row pattern as the others) · หมวดหมู่ · แบรนด์. A row opens its list (2.5); ล้าง sets every
 * row back to ทั้งหมด and turns my car off; ✓ shows the products.
 */
export function FilterSheet({
  initial,
  types,
  brands,
  carBrands,
  carModels,
  onApply,
  onClose,
}: {
  initial: FilterChoice;
  /** every category, most stocked first */
  types: CategoryRow[];
  brands: { id: string; name: string }[];
  carBrands: CarBrandOption[];
  carModels: CarModelOption[];
  onApply: (next: FilterChoice) => void;
  onClose: () => void;
}) {
  const { car } = useMyCar();
  const [choice, setChoice] = useState<FilterChoice>(initial);
  const [view, setView] = useState<"main" | "cats" | "brands" | "car">("main");

  // A car picked (or changed) from here filters straight away.
  const lastCar = useRef(car);
  useEffect(() => {
    if (car && car !== lastCar.current) setChoice((c) => ({ ...c, carOn: true }));
    lastCar.current = car;
  }, [car]);

  const logo = car ? (carBrands.find((b) => b.brand === car.brand)?.logo ?? null) : null;
  const typeRow = types.find((t) => t.id === choice.type);
  const brandRow = brands.find((b) => b.id === choice.brand);
  const back = () => setView("main");

  if (view === "car") {
    return <CarPicker brands={carBrands} models={carModels} onClose={back} />;
  }

  if (view === "cats") {
    return (
      <Sheet title="หมวดหมู่" left="‹ ตัวกรอง" onLeft={back} onDim={onClose} tall>
        <div className="hm-list">
          <PickRow
            on={!choice.type}
            onPick={() => {
              setChoice({ ...choice, type: undefined });
              back();
            }}
          >
            <span className="hm-row-main">ทั้งหมด</span>
          </PickRow>
          {types.map((t) => (
            <PickRow
              key={t.id}
              on={t.id === choice.type}
              onPick={() => {
                setChoice({ ...choice, type: t.id });
                back();
              }}
            >
              {t.imageKey ? (
                <img className="b2-pick-pic" src={imgUrl(t.imageKey)} alt="" loading="lazy" />
              ) : (
                <span className="b2-pick-pic b2-photo-none" aria-hidden="true">
                  ✦
                </span>
              )}
              <span className="hm-row-main">
                {t.nameTh ?? t.name}
                {t.nameEn && <span className="b2-pick-en">{t.nameEn}</span>}
              </span>
              <span className="hm-row-end">{t.productCount} รายการ</span>
            </PickRow>
          ))}
        </div>
      </Sheet>
    );
  }

  if (view === "brands") {
    return (
      <Sheet title="แบรนด์" left="‹ ตัวกรอง" onLeft={back} onDim={onClose}>
        <div className="hm-list">
          <PickRow
            on={!choice.brand}
            onPick={() => {
              setChoice({ ...choice, brand: undefined });
              back();
            }}
          >
            <span className="hm-row-main">ทั้งหมด</span>
          </PickRow>
          {brands.map((b) => (
            <PickRow
              key={b.id}
              on={b.id === choice.brand}
              onPick={() => {
                setChoice({ ...choice, brand: b.id });
                back();
              }}
            >
              <span className="hm-row-main">{b.name}</span>
            </PickRow>
          ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title="ตัวกรอง"
      left="ล้าง"
      onLeft={() => setChoice({ carOn: false })}
      onDim={onClose}
      onOk={() => onApply(choice)}
    >
      <div className="hm-list">
        <button type="button" className="hm-row" onClick={() => setView("car")}>
          <span className="hm-row-main">รถของคุณ</span>
          <span className="hm-row-end b2-val">
            {car && choice.carOn ? (
              <>
                <BrandLogo src={logo} size={24} />
                {`${carName(car)}${car.year === null ? "" : ` ${car.year}`}`}
              </>
            ) : car ? (
              "ทุกรุ่นรถ"
            ) : (
              "เลือกรถ"
            )}
          </span>
          <Icon name="chevron" size={16} />
        </button>
        <button type="button" className="hm-row" onClick={() => setView("cats")}>
          <span className="hm-row-main">หมวดหมู่</span>
          <span className="hm-row-end">
            {typeRow ? (typeRow.nameTh ?? typeRow.name) : "ทั้งหมด"}
          </span>
          <Icon name="chevron" size={16} />
        </button>
        <button type="button" className="hm-row" onClick={() => setView("brands")}>
          <span className="hm-row-main">แบรนด์</span>
          <span className="hm-row-end">{brandRow ? brandRow.name : "ทั้งหมด"}</span>
          <Icon name="chevron" size={16} />
        </button>
      </div>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import type { CarModelOption } from "@/lib/db";
import { carName } from "@/lib/myCar";
import { BrandLogo, CarPicker, MyCarSheet, type CarBrandOption } from "./CarSheets";
import { MyCarCard } from "./MyCarCard";
import { useMyCar } from "./MyCarProvider";
import { PhoneCard } from "./PhoneCard";
import { SubHeader } from "./SubHeader";

/**
 * Board 1 · 1.7: the saved car on a strip (เปลี่ยน → the รถของฉัน sheet), "ใส่ได้กับ … · N รายการ", then
 * every fitting part. No car saved → the รถของฉัน card so the shopper can pick one here.
 */
export function MyCarResults({
  brands,
  models,
}: {
  brands: CarBrandOption[];
  models: CarModelOption[];
}) {
  const { car, ready, fit, fitFailed } = useMyCar();
  const [open, setOpen] = useState<"pick" | "mine" | null>(null);
  const logo = car ? (brands.find((b) => b.brand === car.brand)?.logo ?? null) : null;
  const full = car ? `${carName(car)}${car.year === null ? "" : ` ${car.year}`}` : "";

  return (
    <div className="mycar-page">
      <SubHeader title="อะไหล่ที่ใส่ได้" />
      {ready && !car && <MyCarCard brands={brands} models={models} />}
      {car && (
        <>
          <div className="hm-strip">
            <BrandLogo src={logo} size={32} />
            <span className="hm-strip-text">
              <span className="hm-muted-sm">รถของฉัน</span>
              <b>{full}</b>
            </span>
            <button type="button" className="hm-link" onClick={() => setOpen("mine")}>
              เปลี่ยน
            </button>
          </div>
          {fitFailed && <p className="hm-note">โหลดรายการไม่สำเร็จ กรุณาลองใหม่</p>}
          {!fitFailed && !fit && <p className="hm-note">กำลังโหลด…</p>}
          {fit && (
            <>
              <p className="hm-note">
                ใส่ได้กับ {full} · {fit.count} รายการ
              </p>
              {fit.items.length === 0 ? (
                <p className="hm-empty">ยังไม่มีอะไหล่ที่ใส่ได้กับรถคันนี้</p>
              ) : (
                <div className="hm-grid2 hm-grid2--8 hm-pad">
                  {fit.items.map((item) => (
                    <PhoneCard key={item.variantId} item={item} />
                  ))}
                </div>
              )}
            </>
          )}
          {open === "pick" && (
            <CarPicker brands={brands} models={models} onClose={() => setOpen(null)} />
          )}
          {open === "mine" && (
            <MyCarSheet
              car={car}
              logo={logo}
              onClose={() => setOpen(null)}
              onPickOther={() => setOpen("pick")}
            />
          )}
        </>
      )}
    </div>
  );
}

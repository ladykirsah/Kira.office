"use client";

import { useState } from "react";
import Link from "next/link";
import type { CarModelOption } from "@/lib/db";
import { carName, carYearLine } from "@/lib/myCar";
import { Icon } from "@/components/Icon";
import { BrandLogo, CarPicker, MyCarSheet, type CarBrandOption } from "./CarSheets";
import { useMyCar } from "./MyCarProvider";

/** รถของฉัน card on the phone home page (board 1 · 1.1 / 1.5). */
export function MyCarCard({
  brands,
  models,
  lift = false,
}: {
  brands: CarBrandOption[];
  models: CarModelOption[];
  /** home page: the card rises into the red header (pick A — the red fades behind it) */
  lift?: boolean;
}) {
  const { car, ready, fit } = useMyCar();
  const [open, setOpen] = useState<"pick" | "mine" | null>(null);
  const logo = car ? (brands.find((b) => b.brand === car.brand)?.logo ?? null) : null;

  return (
    <section className={lift ? "hm-car hm-car--lift" : "hm-car"} aria-label="รถของฉัน">
      {car ? (
        <>
          <div className="hm-car-top">
            <span className="hm-muted-sm">รถของฉัน</span>
            <button type="button" className="hm-link" onClick={() => setOpen("mine")}>
              เปลี่ยนรถ
            </button>
          </div>
          <div className="hm-car-who">
            <BrandLogo src={logo} size={52} />
            <span className="hm-car-text">
              <b className="hm-car-name">{carName(car)}</b>
              <span className="hm-muted">{carYearLine(car, fit ? fit.count : null)}</span>
            </span>
          </div>
          <Link className="hm-btn" href="/my-car">
            ดูอะไหล่ที่ใส่ได้
          </Link>
        </>
      ) : (
        <>
          <span className="hm-muted-sm">รถของฉัน</span>
          <div className="hm-car-who">
            <span className="hm-logo hm-logo--none" style={{ width: 52, height: 52 }}>
              <Icon name="car" size={28} />
            </span>
            <span className="hm-car-text">
              <b className="hm-car-ask">เลือกรุ่นรถของคุณ</b>
              <span className="hm-muted">เพื่อการหาอะไหล่ที่ง่ายกว่าเดิม</span>
            </span>
          </div>
          <button
            type="button"
            className="hm-btn"
            disabled={!ready}
            onClick={() => setOpen("pick")}
          >
            เลือกรถ
          </button>
        </>
      )}
      {open === "pick" && (
        <CarPicker brands={brands} models={models} onClose={() => setOpen(null)} />
      )}
      {open === "mine" && car && (
        <MyCarSheet
          car={car}
          logo={logo}
          onClose={() => setOpen(null)}
          onPickOther={() => setOpen("pick")}
        />
      )}
    </section>
  );
}

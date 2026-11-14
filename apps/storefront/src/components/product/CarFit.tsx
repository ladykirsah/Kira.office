"use client";

import { useState } from "react";
import type { CarModelOption } from "@/lib/db";
import { carCard, fitRows, type Fitment } from "@/lib/productPage";
import { Icon } from "@/components/Icon";
import { CarPicker, MyCarSheet, type CarBrandOption } from "@/components/home/CarSheets";
import { useMyCar } from "@/components/home/MyCarProvider";

/**
 * The car card and ใส่ได้กับรถ (board 3 · 3.1 / 3.6 / 3.7): the card says whether the part fits the
 * saved รถของฉัน (เปลี่ยนรถ → board 1 · 1.6, เลือกรถ → 1.2); the list below shows EVERY model, open
 * (owner, 14 Nov 2026: "default shown of all models - not hidden") — the saved car's ✓ is blue.
 * A part made for no car (oil) shows neither.
 */
export function CarFit({
  fitments,
  brands,
  models,
}: {
  fitments: Fitment[];
  brands: CarBrandOption[];
  models: CarModelOption[];
}) {
  const { car, ready } = useMyCar();
  const [open, setOpen] = useState<"pick" | "mine" | null>(null);
  if (fitments.length === 0) return null;
  // before the saved car is read, the card waits (no "เลือกรถ" flash for a shopper who has one)
  const words = ready ? carCard(fitments, car) : null;
  const rows = fitRows(fitments, ready ? car : null);
  const logo = car ? (brands.find((b) => b.brand === car.brand)?.logo ?? null) : null;

  return (
    <>
      {words && (
        <div className="pp-car">
          <span className={`pp-car-ic pp-car-ic--${words.kind}`} aria-hidden="true">
            <Icon name={words.kind === "yes" ? "check" : "car"} size={20} />
          </span>
          <span className="pp-car-t">
            <b>{words.title}</b>
            <span>{words.sub}</span>
          </span>
          <button
            type="button"
            className="pp-link"
            onClick={() => setOpen(words.kind === "none" ? "pick" : "mine")}
          >
            {words.action}
          </button>
        </div>
      )}
      {/* Apple's grouped list (board 3A): the heading above the card, Settings rows inside */}
      <section className="pp-group" aria-label="ใส่ได้กับรถ">
        <div className="pp-head">
          <h2 className="pp-ct">ใส่ได้กับรถ</h2>
          <span className="pp-cnt">{rows.length} รุ่น</span>
        </div>
        <ul className="pp-card pp-fit-list">
          {rows.map((r, i) => (
            <li
              key={`${r.name}-${i}`}
              className={r.mine ? "pp-fit-row pp-fit-row--mine" : "pp-fit-row"}
            >
              <Icon name="check" size={18} />
              <span className="pp-fit-in">
                <span className="pp-fit-n">{r.name}</span>
                <span className="pp-fit-y">{r.years}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
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
    </>
  );
}

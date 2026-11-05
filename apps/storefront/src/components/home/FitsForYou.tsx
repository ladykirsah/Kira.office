"use client";

import Link from "next/link";
import { PhoneCard } from "./PhoneCard";
import { useMyCar } from "./MyCarProvider";

/** "ใส่ได้กับ Vigo ของคุณ" (board 1 · 1.5): the first two parts that fit the saved car. Hidden with no
 *  car, while loading, on a failed load, or when nothing fits yet. */
export function FitsForYou() {
  const { car, fit } = useMyCar();
  if (!car || !fit || fit.items.length === 0) return null;
  return (
    <section className="hm-sec" aria-label={`ใส่ได้กับ ${car.model} ของคุณ`}>
      <div className="hm-sec-head">
        <h2 className="hm-sec-t">ใส่ได้กับ {car.model} ของคุณ</h2>
        <Link className="hm-more" href="/my-car">
          ดูทั้งหมด
        </Link>
      </div>
      <div className="hm-grid2">
        {fit.items.slice(0, 2).map((item) => (
          <PhoneCard key={item.variantId} item={item} />
        ))}
      </div>
    </section>
  );
}

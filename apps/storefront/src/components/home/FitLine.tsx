"use client";

import { Icon } from "@/components/Icon";
import { fitLine } from "@/lib/myCar";
import { useMyCar } from "./MyCarProvider";

/**
 * The extra line on a product card for the saved รถของฉัน: blue ✓ "ใส่ได้กับ Vigo 2012" or grey
 * "ไม่ใช่ของ Vigo". Nothing without a saved car, for parts made for no car, or while loading.
 * Sits under พร้อมส่ง and above the price (owner, 5 Nov 2026).
 */
export function FitLine({ variantId, hasFitment }: { variantId: string; hasFitment: boolean }) {
  const { car, fit } = useMyCar();
  if (!fit) return null;
  const line = fitLine(car, hasFitment, fit.ids.has(variantId));
  if (!line) return null;
  return line.fits ? (
    <span className="hm-fit">
      <Icon name="check" size={15} />
      {line.text}
    </span>
  ) : (
    <span className="hm-nofit">{line.text}</span>
  );
}

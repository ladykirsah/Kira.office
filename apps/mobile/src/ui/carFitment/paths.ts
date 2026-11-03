import type { CarBrand, CarModel } from "@/lib/carFitmentPage";

/** รุ่นรถที่ใช้ได้'s pages: the brands, one brand, one model. */
export const FIT_BASE = "/settings/car-fitment";
export const brandPath = (b: CarBrand) => `${FIT_BASE}/${encodeURIComponent(b.id)}`;
export const modelPath = (b: CarBrand, m: CarModel) =>
  `${brandPath(b)}/${encodeURIComponent(m.id)}`;

import type { Phrase } from "@l-shopee/shared/lang";
import { longDate } from "./customerPage";
import { formatBaht } from "./money";

/**
 * What หน้าสินค้า shows (canvas v194): one ราคา list — ต้นทุน first as the total, then the four prices
 * — where each ⌄ drops the sum or the profit; then the part's sizes and when it was last edited.
 * The money rules are the web back office's (apps/admin/src/lib/pricing.ts). No screen code here.
 */

export interface Pricing {
  itemCostSatang: number;
  /** 1 = the cost carries 7% VAT on top. */
  taxOnCost: number;
  /** The เด่นแอร์ counter price. */
  targetPriceSatang: number;
  /** ช่าง. */
  b2bPriceSatang: number;
  /** AirPlus. */
  onlinePriceSatang: number;
  shopeePriceSatang: number;
  /** Shopee's fee in hundredths of a percent; taken off the Shopee price only. */
  onlineCommissionBp: number;
}

export interface PriceLine {
  label: Phrase;
  text: string;
  /** Red words: a price below the cost (the guide's only red text besides errors). */
  loss: boolean;
}

export interface PriceRow {
  key: "cost" | "den" | "mechanic" | "airplus" | "shopee";
  label: Phrase;
  satang: number;
  /** What ⌄ drops down; empty = no ⌄. */
  lines: PriceLine[];
}

export interface GalleryImage {
  id: string;
  imageKey: string;
  sortOrder: number;
  isCover: number;
}

const VAT_RATE = 0.07;

export function totalCostSatang(costSatang: number, taxOnCost: boolean): number {
  return taxOnCost ? Math.round(costSatang * (1 + VAT_RATE)) : costSatang;
}

const percent = (bp: number) => `${bp / 100}%`;

function profitLines(price: number, cost: number, feeBp: number): PriceLine[] {
  if (price <= 0) return [];
  const fee = Math.round((price * feeBp) / 10000);
  const profit = price - cost - fee;
  const feeLine: PriceLine[] =
    fee > 0
      ? [
          {
            label: { th: `ค่าคอม ${percent(feeBp)}`, en: `Fee ${percent(feeBp)}` },
            text: `– ${formatBaht(fee)}`,
            loss: false,
          },
        ]
      : [];
  if (profit < 0) {
    return [
      ...feeLine,
      { label: { th: "ขาดทุน", en: "Loss" }, text: formatBaht(-profit), loss: true },
    ];
  }
  const margin = Math.round((profit / price) * 100);
  return [
    ...feeLine,
    {
      label: { th: "กำไร", en: "Profit" },
      text: `${formatBaht(profit)} · ${margin}%`,
      loss: false,
    },
  ];
}

export function priceRows(pricing: Pricing | null, seesCost: boolean): PriceRow[] {
  const p = pricing ?? {
    itemCostSatang: 0,
    taxOnCost: 0,
    targetPriceSatang: 0,
    b2bPriceSatang: 0,
    onlinePriceSatang: 0,
    shopeePriceSatang: 0,
    onlineCommissionBp: 0,
  };
  const cost = totalCostSatang(p.itemCostSatang, p.taxOnCost === 1);
  const price = (key: PriceRow["key"], label: Phrase, satang: number, feeBp = 0): PriceRow => ({
    key,
    label,
    satang,
    lines: seesCost ? profitLines(satang, cost, feeBp) : [],
  });
  const prices = [
    price("den", { th: "เด่นแอร์", en: "Den Air" }, p.targetPriceSatang),
    price("mechanic", { th: "ช่าง", en: "Mechanic" }, p.b2bPriceSatang),
    price("airplus", { th: "AirPlus", en: "AirPlus" }, p.onlinePriceSatang),
    price("shopee", { th: "Shopee", en: "Shopee" }, p.shopeePriceSatang, p.onlineCommissionBp),
  ];
  if (!seesCost) return prices;
  const costLines: PriceLine[] =
    p.taxOnCost === 1
      ? [
          {
            label: { th: "ต้นทุนสินค้า", en: "Item cost" },
            text: formatBaht(p.itemCostSatang),
            loss: false,
          },
          {
            label: { th: "VAT 7%", en: "VAT 7%" },
            text: `+ ${formatBaht(cost - p.itemCostSatang)}`,
            loss: false,
          },
        ]
      : [];
  return [
    { key: "cost", label: { th: "ต้นทุน", en: "Cost" }, satang: cost, lines: costLines },
    ...prices,
  ];
}

const DASH: Phrase = { th: "—", en: "—" };
const cm = (mm: number) => Math.round(mm) / 10;

export function weightText(grams: number): Phrase {
  if (!grams) return DASH;
  const kg = Math.round(grams / 100) / 10;
  return { th: `${kg} กก.`, en: `${kg} kg` };
}

/** Width × length × height, as the web back office prints it. */
export function boxText(
  widthMm: number | null,
  lengthMm: number | null,
  heightMm: number | null,
): Phrase {
  if (!widthMm || !lengthMm || !heightMm) return DASH;
  const sides = `${cm(widthMm)} × ${cm(lengthMm)} × ${cm(heightMm)}`;
  return { th: `${sides} ซม.`, en: `${sides} cm` };
}

export function editedLine(updatedAt: number | null): Phrase | null {
  if (updatedAt == null) return null;
  const d = longDate(updatedAt);
  return { th: `แก้ไขล่าสุด ${d.th}`, en: `Last edited ${d.en}` };
}

/** The photos in their order; a product from before the gallery has only its cover. */
export function galleryKeys(cover: string | null, images: readonly GalleryImage[]): string[] {
  if (images.length > 0)
    return [...images].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.imageKey);
  return cover ? [cover] : [];
}

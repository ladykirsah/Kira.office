import { resolveEffectivePrice, type CampaignPriceInfo } from "@l-shopee/core";
import { baht } from "./format";

/**
 * ตัวเลือกสินค้า (sizes) on AirPlus — board 3b, owner's picks 11 Nov 2026: the card says "3 ขนาด" with
 * "เริ่ม ฿30"; the product page shows the in-stock price range and a Shopee-style size sheet whose
 * button stays grey until a size is picked. Pure helpers only — the screens import them.
 */

/** The slice of a product choice (StorefrontChoice) the size picker reads. */
export interface PickChoice {
  variantId: string;
  optionName: string | null;
  value: string | null;
  imageKey: string | null;
  priceSatang: number;
  onHand: number;
  campaign: CampaignPriceInfo | null;
}

export type ChipState = "picked" | "out" | "open";

/** "ขนาด 1/2 กลาง" — the option's own name when the shop gave one, else ขนาด. */
export function sizeLabel(value: string, optionName?: string | null): string {
  return `${optionName?.trim() || "ขนาด"} ${value}`;
}

/** A product with sizes: any of its choices carries a value (a normal product's one variant has none). */
export function hasSizes(choices: readonly { value: string | null }[]): boolean {
  return choices.some((c) => Boolean(c.value?.trim()));
}

/** The card's extra line under พร้อมส่ง: "3 ขนาด" for a sized product, nothing for a normal one. */
export function cardSizeLine(choiceCount: number): string | null {
  return choiceCount > 1 ? `${choiceCount} ขนาด` : null;
}

/** What the shopper pays for this size now: a live flash price, else its online price. */
export function choicePrice(c: PickChoice, now: number): number {
  return resolveEffectivePrice(c.priceSatang, c.campaign, now).priceSatang;
}

/** Lowest and highest price among the sizes you can buy (in stock); null when none is. */
export function priceRange(
  choices: readonly PickChoice[],
  now: number,
): { lowSatang: number; highSatang: number } | null {
  const prices = choices.filter((c) => c.onHand > 0).map((c) => choicePrice(c, now));
  if (prices.length === 0) return null;
  return { lowSatang: Math.min(...prices), highSatang: Math.max(...prices) };
}

/** "฿30 – ฿40", or one price when every size costs the same. */
export function rangeText(range: { lowSatang: number; highSatang: number }): string {
  return range.lowSatang === range.highSatang
    ? baht(range.lowSatang)
    : `${baht(range.lowSatang)} – ${baht(range.highSatang)}`;
}

/** A size chip: sold out wins (grey, "หมด", not tappable), then the picked one, else open. */
export function chipState(c: PickChoice, pickedId: string | null): ChipState {
  if (c.onHand <= 0) return "out";
  return c.variantId === pickedId ? "picked" : "open";
}

/** The sheet's button turns red only once a size that is in stock is picked. */
export function canConfirm(choices: readonly PickChoice[], pickedId: string | null): boolean {
  const picked = choices.find((c) => c.variantId === pickedId);
  return picked !== undefined && picked.onHand > 0;
}

/** The จำนวน stepper: at least 1, at most what is in stock. */
export function clampQty(n: number, onHand: number): number {
  return Math.max(1, Math.min(Math.floor(n), Math.max(onHand, 1)));
}

/** The sheet's top: the picked size's photo, price and "เหลือ N ชิ้น · ขนาด X"; before a pick, the range,
 *  "เลือกขนาด" and the first size you can buy's photo. */
export function sheetHead(
  choices: readonly PickChoice[],
  pickedId: string | null,
  now: number,
): { imageKey: string | null; price: string; sub: string } {
  const picked = choices.find((c) => c.variantId === pickedId && c.onHand > 0);
  if (picked) {
    return {
      imageKey: picked.imageKey,
      price: baht(choicePrice(picked, now)),
      sub: `เหลือ ${picked.onHand} ชิ้น · ${sizeLabel(picked.value ?? "", picked.optionName)}`,
    };
  }
  const first = choices.find((c) => c.onHand > 0) ?? choices[0];
  const range = priceRange(choices, now);
  return {
    imageKey: first?.imageKey ?? null,
    price: range ? rangeText(range) : "",
    sub: `เลือก${first?.optionName?.trim() || "ขนาด"}`,
  };
}

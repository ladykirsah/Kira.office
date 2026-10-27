import type { Phrase } from "@l-shopee/shared/lang";
import { formatBaht } from "./money";
import type { ScanCard, ScannedPart } from "./scanTabs";

/**
 * The money side of Scan's ขาย tab (owner approved, 2026-10-26): ลูกค้า pays the walk-in price and
 * finishes at ทำบิล; ช่าง pays the mechanic price here, by cash or PromptPay, and gets the bill.
 */

export type Buyer = "customer" | "mechanic";

export interface BillLine {
  productVariantId: string;
  lineType: "part";
  description: string;
  barcodeValue: string;
  quantity: number;
  unitPriceSatang: number;
  unitCostSatang: number;
}

/** ช่าง pays the mechanic price; with none set, the walk-in price — the same fallback as ทำบิล. */
export function unitPrice(part: ScannedPart, buyer: Buyer): number {
  if (buyer === "mechanic" && part.b2bPriceSatang > 0) return part.b2bPriceSatang;
  return part.unitPriceSatang;
}

/** The card's price line: ฿3,450 (3,100) — the walk-in price, the mechanic price in brackets. */
export function priceTag(part: ScannedPart): { price: string; mechanic: string } {
  return {
    price: formatBaht(part.unitPriceSatang),
    mechanic: `(${formatBaht(unitPrice(part, "mechanic")).replace("฿", "")})`,
  };
}

export function saleTotal(cards: readonly ScanCard[], buyer: Buyer): number {
  return cards.reduce((sum, c) => sum + unitPrice(c.part, buyer) * c.value, 0);
}

/** The line name ทำบิล prints: the brand inline ("Compressor · Denso"), or just the name. */
function lineName(part: ScannedPart): string {
  const brand = part.brandName?.trim();
  return brand ? `${part.name} · ${brand}` : part.name;
}

export function saleLines(cards: readonly ScanCard[], buyer: Buyer): BillLine[] {
  return cards.map((c) => ({
    productVariantId: c.part.variantId,
    lineType: "part",
    description: lineName(c.part),
    barcodeValue: c.part.barcode,
    quantity: c.value,
    unitPriceSatang: unitPrice(c.part, buyer),
    unitCostSatang: c.part.unitCostSatang,
  }));
}

/** More to sell than is for sale. The server refuses the sale too; this says so before money. */
export function overSold(cards: readonly ScanCard[]): ScanCard[] {
  return cards.filter((c) => c.value > c.part.onHand);
}

export interface SaleRecord {
  clientUuid: string;
  saleNumber: string;
  paymentMethod: "cash" | "promptpay";
  saleType: "parts";
  lines: BillLine[];
}

/** What POST /sync answers for one sale. */
export interface SyncResult {
  applied: number;
  duplicates: number;
  conflicts: { productVariantId: string; requested: number; available: number }[];
  validationErrors: { clientUuid: string; reason: string }[];
}

const SALE_PREFIX = "DAS";
const SALE_NUMBER = /^([A-Za-z]+)(\d{4})(\d{2})-(\d{2})(\d+)$/;
const pad = (n: number, width: number) => String(n).padStart(width, "0");

/**
 * The next bill number in the shop's own form, DASyyyymm-ddnnn (Den Air Service, then the date, then
 * the day's running number) — the same numbers ทำบิล issues. It follows the highest number already
 * issued today on any device, so the caller passes the server's latest bills as well as its own.
 */
export function nextSaleNumber(known: readonly (string | null | undefined)[], now: number): string {
  const d = new Date(now);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  let highest = 0;
  for (const id of known) {
    const m = id ? SALE_NUMBER.exec(id) : null;
    if (!m || m[1] !== SALE_PREFIX) continue;
    if (Number(m[2]) !== year || Number(m[3]) !== month || Number(m[4]) !== day) continue;
    highest = Math.max(highest, Number(m[5]));
  }
  return `${SALE_PREFIX}${year}${pad(month, 2)}-${pad(day, 2)}${pad(highest + 1, 3)}`;
}

/** The sale exactly as ทำบิล sends it to POST /sync, so both record the same thing. */
export function buildSale(input: Omit<SaleRecord, "saleType">): SaleRecord {
  return { ...input, saleType: "parts" };
}

/** Saved now, or already saved by an earlier try of the same sale (the server keys on clientUuid). */
export function saleSaved(result: SyncResult): boolean {
  if (result.conflicts.length > 0 || result.validationErrors.length > 0) return false;
  return result.applied > 0 || result.duplicates > 0;
}

export function saleRefusal(result: SyncResult): Phrase {
  const conflict = result.conflicts[0];
  if (conflict) {
    return {
      th: `สต็อกไม่พอ: มี ${conflict.available} ขอ ${conflict.requested} แก้จำนวนแล้วลองอีกครั้ง`,
      en: `Not enough stock: ${conflict.available} there, ${conflict.requested} asked. Fix the amount and try again.`,
    };
  }
  const refused = result.validationErrors.map((e) => e.reason).join("; ");
  if (refused) {
    return { th: `ระบบไม่รับบิลนี้: ${refused}`, en: `The system refused this bill: ${refused}` };
  }
  return {
    th: "ระบบไม่รับบิลนี้ ตรวจรายการแล้วลองอีกครั้ง",
    en: "The system refused this bill. Check the items and try again.",
  };
}

const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

/** The bill's date the Thai way — 26 ต.ค. 2569, Buddhist year — and its time, 14:32. */
export function billDate(at: number): { date: string; time: string } {
  const d = new Date(at);
  return {
    date: `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`,
    time: `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`,
  };
}

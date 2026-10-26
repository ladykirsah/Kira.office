import type { Phrase } from "@l-shopee/shared/lang";
import { formatBaht } from "./money";

/**
 * The rules behind Scan (approved design, 2026-10-26): what a scan adds to the list, what each row's
 * grey line says before anything is saved, and what the one red button says. No screen code here.
 */

export type ScanMode = "add" | "view" | "hold" | "fill" | "sell";
export type HoldWay = "takeAway" | "bringBack";

const SCAN_MODES: readonly ScanMode[] = ["add", "view", "hold", "fill", "sell"];

export interface ScannedPart {
  variantId: string;
  productId: string;
  productRef: string;
  name: string;
  imageKey: string | null;
  /** Sellable on hand — the API already leaves held stock out of it. */
  onHand: number;
  held: number;
  unitPriceSatang: number;
  unitCostSatang: number;
  qty: number;
}

export interface HoldLine {
  productVariantId: string;
  takeAway: number;
  bringBack: number;
}

export interface BillLine {
  productVariantId: string;
  lineType: "part";
  description: string;
  barcodeValue: string;
  quantity: number;
  unitPriceSatang: number;
  unitCostSatang: number;
}

/** First visit opens on View: the one mode where a stray scan changes nothing. */
export function readMode(raw: string | null): ScanMode {
  return SCAN_MODES.find((m) => m === raw) ?? "view";
}

/**
 * A new part goes on top, nearest the camera. Scanning a part already in a bill adds one more, as a
 * till does; in a stock list it keeps the amount already set, so a double read never doubles it.
 */
export function addPart(
  list: readonly ScannedPart[],
  part: ScannedPart,
  mode: ScanMode,
): ScannedPart[] {
  const existing = list.find((p) => p.variantId === part.variantId);
  if (!existing) return [part, ...list];
  if (mode !== "sell") return [...list];
  return list.map((p) => (p.variantId === part.variantId ? { ...p, qty: p.qty + 1 } : p));
}

export function setQty(
  list: readonly ScannedPart[],
  variantId: string,
  qty: number,
): ScannedPart[] {
  const clean = Number.isFinite(qty) ? Math.max(1, Math.round(qty)) : 1;
  return list.map((p) => (p.variantId === variantId ? { ...p, qty: clean } : p));
}

export function removePart(list: readonly ScannedPart[], variantId: string): ScannedPart[] {
  return list.filter((p) => p.variantId !== variantId);
}

const same = (text: string): Phrase => ({ th: text, en: text });

/** The row's grey second line: what will change, shown before anything is saved. */
export function partLine(part: ScannedPart, mode: ScanMode, way: HoldWay): Phrase {
  if (mode === "sell") {
    const price = formatBaht(part.unitPriceSatang);
    return same(part.qty > 1 ? `${price} × ${part.qty}` : price);
  }
  if (mode === "hold") {
    const after = way === "takeAway" ? part.held + part.qty : part.held - part.qty;
    return { th: `พักอยู่ ${part.held} → ${after}`, en: `On hold ${part.held} → ${after}` };
  }
  const after = part.onHand + part.qty;
  return { th: `มีอยู่ ${part.onHand} → ${after}`, en: `On hand ${part.onHand} → ${after}` };
}

/** Moving more stock than there is. The API refuses it too; this says so before the tap. */
export function partProblem(part: ScannedPart, mode: ScanMode, way: HoldWay): Phrase | null {
  if (mode !== "hold") return null;
  if (way === "takeAway" && part.qty > part.onHand) {
    return { th: `ขายได้อยู่ ${part.onHand} ชิ้น`, en: `Only ${part.onHand} for sale` };
  }
  if (way === "bringBack" && part.qty > part.held) {
    return { th: `พักอยู่แค่ ${part.held} ชิ้น`, en: `Only ${part.held} on hold` };
  }
  return null;
}

const pieces = (list: readonly ScannedPart[]) => list.reduce((sum, p) => sum + p.qty, 0);

/** The one red button names what it does and how much — never just "Submit". */
export function actionLabel(list: readonly ScannedPart[], mode: ScanMode, way: HoldWay): Phrase {
  if (mode === "sell") {
    const total = formatBaht(list.reduce((sum, p) => sum + p.unitPriceSatang * p.qty, 0));
    return { th: `สร้างบิล · ${total}`, en: `Create bill · ${total}` };
  }
  const n = pieces(list);
  if (mode === "hold") {
    return way === "takeAway"
      ? { th: `ย้ายไปพัก · ${n} ชิ้น`, en: `Put on hold · ${n} pcs` }
      : { th: `นำกลับเข้าร้าน · ${n} ชิ้น`, en: `Bring back · ${n} pcs` };
  }
  return { th: `รับเข้าสต็อก · ${n} ชิ้น`, en: `Receive · ${n} pcs` };
}

/** One direction for the whole batch (approved design): every line takes away, or every line brings back. */
export function holdLines(list: readonly ScannedPart[], way: HoldWay): HoldLine[] {
  return list.map((p) => ({
    productVariantId: p.variantId,
    takeAway: way === "takeAway" ? p.qty : 0,
    bringBack: way === "bringBack" ? p.qty : 0,
  }));
}

export function billLines(list: readonly ScannedPart[]): BillLine[] {
  return list.map((p) => ({
    productVariantId: p.variantId,
    lineType: "part",
    description: p.name,
    barcodeValue: p.productRef,
    quantity: p.qty,
    unitPriceSatang: p.unitPriceSatang,
    unitCostSatang: p.unitCostSatang,
  }));
}

/**
 * What is left on the Sell list once a bill is saved: the amounts that went on the bill come off,
 * and anything scanned while it was saving stays for the next bill.
 */
export function afterBilling(
  list: readonly ScannedPart[],
  billed: readonly BillLine[],
): ScannedPart[] {
  return list
    .map((p) => {
      const gone = billed
        .filter((b) => b.productVariantId === p.variantId)
        .reduce((sum, b) => sum + b.quantity, 0);
      return { ...p, qty: p.qty - gone };
    })
    .filter((p) => p.qty > 0);
}

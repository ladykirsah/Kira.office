import type { Phrase } from "@l-shopee/shared/lang";

/**
 * The rules behind Scan v2 (owner approved, 2026-10-26): three tabs — ขาย, งานนอก, จัดการสต็อก —
 * share one full product card whose − n + number means what the tab is about. No screen code here.
 */

export type ScanTab = "sell" | "away" | "stock";

export interface ScannedPart {
  variantId: string;
  productId: string;
  productRef: string;
  name: string;
  brandName: string | null;
  /** The code that was scanned — what ทำบิล stores on the bill line. */
  barcode: string;
  /** The product's photos in gallery order; empty when it has none. */
  photoKeys: string[];
  /** Sellable on hand — the API already leaves stock out on jobs (held) out of it. */
  onHand: number;
  /** Out on outside jobs (งานนอก). */
  held: number;
  /** ราคาลูกค้า — the walk-in price. */
  unitPriceSatang: number;
  /** ราคาช่าง — the mechanic price; 0 when none is set. */
  b2bPriceSatang: number;
  unitCostSatang: number;
}

/** One scanned product and the number its stepper shows. */
export interface ScanCard {
  part: ScannedPart;
  /** ขาย: how many to sell · งานนอก: how many out on jobs · จัดการสต็อก: how many for sale. */
  value: number;
}

const TABS: readonly ScanTab[] = ["sell", "away", "stock"];

/** The app remembers the last tab; a first visit, or an old Scan v1 mode, opens on ขาย. */
export function readTab(raw: string | null): ScanTab {
  return TABS.find((t) => t === raw) ?? "sell";
}

function startValue(part: ScannedPart, tab: ScanTab): number {
  if (tab === "sell") return 1;
  return tab === "away" ? part.held : part.onHand;
}

/**
 * The scanned part goes on top, nearest the camera. Scanning a part already on the sale sells one
 * more, as a till does; on a stock tab it keeps the number already set, so a double read never
 * doubles a count.
 */
export function addScan(cards: readonly ScanCard[], part: ScannedPart, tab: ScanTab): ScanCard[] {
  const existing = cards.find((c) => c.part.variantId === part.variantId);
  const rest = cards.filter((c) => c.part.variantId !== part.variantId);
  if (!existing) return [{ part, value: startValue(part, tab) }, ...rest];
  const value = tab === "sell" ? existing.value + 1 : existing.value;
  return [{ ...existing, value }, ...rest];
}

/** The highest the number may go: a job can take out at most everything in the shop. */
function ceiling(part: ScannedPart, tab: ScanTab): number {
  return tab === "away" ? part.onHand + part.held : Number.POSITIVE_INFINITY;
}

/** − or + on one card. On ขาย, − at 1 takes the part off the sale; the other tabs stop at 0. */
export function step(
  cards: readonly ScanCard[],
  variantId: string,
  tab: ScanTab,
  by: 1 | -1,
): ScanCard[] {
  return cards.flatMap((c) => {
    if (c.part.variantId !== variantId) return [c];
    const next = c.value + by;
    if (tab === "sell" && next < 1) return [];
    return [{ ...c, value: Math.min(Math.max(next, 0), ceiling(c.part, tab)) }];
  });
}

const STEP_LABELS: Record<ScanTab, Phrase> = {
  sell: { th: "จำนวนที่ขาย", en: "To sell" },
  away: { th: "อยู่งานนอก", en: "Out on jobs" },
  stock: { th: "พร้อมขาย", en: "For sale" },
};

export function stepLabel(tab: ScanTab): Phrase {
  return STEP_LABELS[tab];
}

/** The grey line under the label: the stock as it is now, before anything is saved. */
export function stockLine(part: ScannedPart, tab: ScanTab): Phrase {
  if (tab === "stock") {
    return {
      th: `${part.onHand} · งานนอก ${part.held}`,
      en: `${part.onHand} · out on jobs ${part.held}`,
    };
  }
  return {
    th: `พร้อมขาย ${part.onHand} · งานนอก ${part.held}`,
    en: `For sale ${part.onHand} · out on jobs ${part.held}`,
  };
}

export interface HoldLine {
  productVariantId: string;
  takeAway: number;
  bringBack: number;
}

/** Why a for-sale count went down (จัดการสต็อก): counted again, or damaged or lost. */
export type DownReason = "recount" | "damaged";

export interface StockMove {
  productVariantId: string;
  quantityDelta?: number;
  countedOnHand?: number;
  movementType: "receive" | "correction" | "write_off";
  reason: string;
}

/** The cards a บันทึก would record: those whose number differs from the stock as it is. */
export function changedCards(cards: readonly ScanCard[], tab: ScanTab): ScanCard[] {
  return cards.filter((c) => c.value !== startValue(c.part, tab));
}

/** งานนอก: more out than now takes the difference out; fewer brings the difference back. */
export function holdMoves(cards: readonly ScanCard[]): HoldLine[] {
  return changedCards(cards, "away").map((c) => {
    const delta = c.value - c.part.held;
    return {
      productVariantId: c.part.variantId,
      takeAway: Math.max(delta, 0),
      bringBack: Math.max(-delta, 0),
    };
  });
}

const lowered = (c: ScanCard) => c.value < c.part.onHand;

export function needsReason(cards: readonly ScanCard[]): boolean {
  return cards.some(lowered);
}

/**
 * จัดการสต็อก: a raised count is stock received. A lowered one is either a recount — the new count
 * is sent as counted, so the server works the difference out from its own figure — or a write-off.
 */
export function stockMoves(cards: readonly ScanCard[], reason: DownReason | null): StockMove[] {
  return changedCards(cards, "stock").map((c) => {
    const productVariantId = c.part.variantId;
    if (!lowered(c)) {
      return {
        productVariantId,
        quantityDelta: c.value - c.part.onHand,
        movementType: "receive",
        reason: "received via Scan",
      };
    }
    if (reason === "recount") {
      return {
        productVariantId,
        countedOnHand: c.value,
        movementType: "correction",
        reason: "recounted via Scan",
      };
    }
    if (reason === "damaged") {
      return {
        productVariantId,
        quantityDelta: c.value - c.part.onHand,
        movementType: "write_off",
        reason: "damaged or lost via Scan",
      };
    }
    throw new Error("a lowered count needs a reason: recount or damaged");
  });
}

/**
 * The ขาย list once a sale went through: the amounts sold come off, and anything scanned while the
 * pay sheet was open stays for the next sale.
 */
export function afterSale(cards: readonly ScanCard[], sold: readonly ScanCard[]): ScanCard[] {
  return cards.flatMap((c) => {
    const gone = sold.find((s) => s.part.variantId === c.part.variantId)?.value ?? 0;
    const left = c.value - gone;
    return left > 0 ? [{ ...c, value: left }] : [];
  });
}

/** The sale's identity for the pay sheet: the same parts and amounts give the same key. */
export function cartKey(cards: readonly ScanCard[]): string {
  return cards
    .map((c) => `${c.part.variantId}:${c.value}`)
    .sort()
    .join(",");
}

/** What happened to one part's save; "unsure" is a dropped connection, when it may have saved. */
export type SaveOutcome = "applied" | "refused" | "unsure";

/**
 * The cards left after บันทึก: saved ones go; refused ones stay to fix; ones not sent (scanned while
 * saving) stay. An unsure one goes too — sending its change again could count it twice, so the
 * person scans it again to see the stock as it really is now.
 */
export function keepAfterSave(
  cards: readonly ScanCard[],
  outcomes: Record<string, SaveOutcome>,
): ScanCard[] {
  return cards.filter((c) => {
    const outcome = outcomes[c.part.variantId];
    return outcome === undefined || outcome === "refused";
  });
}

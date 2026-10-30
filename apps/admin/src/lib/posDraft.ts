import type { DiscountKind } from "./posCart";

/**
 * Mapping between the POS cart and the /onsite/drafts API shape, so a work-in-progress cart can be
 * parked on the server (any device reopens it) and later finalized through the normal checkout.
 * Pure + unit-tested; the React POS page holds the state and calls these.
 */

/** A cart line's fields relevant to persisting/restoring a draft (subset of the POS SaleLine). */
export interface DraftCartLine {
  kind: "part" | "service";
  name: string;
  productVariantId?: string | null;
  barcodeValue?: string;
  quantity: number;
  unitPriceSatang: number;
  unitCostSatang?: number;
}

/** The line shape the /onsite/drafts API stores (a subset of the sync line). */
export interface DraftApiLine {
  productVariantId: string | null;
  lineType: "part" | "service";
  description: string;
  barcodeValue?: string;
  quantity: number;
  unitPriceSatang: number;
  unitCostSatang: number;
}

/** A cart line restored from a saved draft — a POS SaleLine minus the optional presentation fields. */
export interface RestoredCartLine extends DraftCartLine {
  uid: string;
}

/**
 * Cart → draft-API lines. A draft stores items at unit price; the bill discount is applied only at
 * finalize (checkout), so no per-line discount is persisted here.
 */
export function cartToDraftLines(lines: DraftCartLine[]): DraftApiLine[] {
  return lines.map((l) => ({
    productVariantId: l.kind === "part" ? (l.productVariantId ?? null) : null,
    lineType: l.kind,
    description: l.name,
    barcodeValue: l.barcodeValue,
    quantity: l.quantity,
    unitPriceSatang: l.unitPriceSatang,
    unitCostSatang: l.unitCostSatang ?? 0,
  }));
}

/** Draft-API lines → cart lines, for reopening a saved draft into the POS (uid via `newUid`). */
export function draftToCartLines(lines: DraftApiLine[], newUid: () => string): RestoredCartLine[] {
  return lines.map((l) => ({
    uid: newUid(),
    kind: l.lineType,
    name: l.description,
    productVariantId: l.productVariantId,
    barcodeValue: l.barcodeValue,
    quantity: l.quantity,
    unitPriceSatang: l.unitPriceSatang,
    unitCostSatang: l.unitCostSatang,
  }));
}

/**
 * The bill in progress, saved in this browser so a page switch or a refresh doesn't lose it.
 * Not a sale and not on the server — the parked draft/quotation above is the shareable copy.
 */
export interface LocalPosDraft<L> {
  lines: L[];
  plate: string;
  province: string;
  mileage: string;
  note: string;
  billDate: string;
  carBrandId: string;
  carModelId: string;
  carYear: string;
  docType: "bill" | "quotation";
  /**
   * The bill discount as typed. Coming back from /payment remounts the page and the sale is
   * completed from what is restored here, so without it the sale was recorded at full price.
   */
  discountKind: DiscountKind;
  discountValue: string;
  /** A new plate's customer, filed at checkout — which, after /payment, runs from the restore. */
  customerName: string;
  phones: string[];
  /** Paper and language, so the bill printed after payment is the one staff set up. */
  billLang: "th" | "en";
  billStyle: "invoice" | "thermal";
}

/**
 * Read a saved local draft back. Only well-typed fields come back; anything missing, corrupt or
 * from an older shape is simply left out, so the page keeps its own default for it.
 */
export function readLocalDraft<L>(raw: string | null): Partial<LocalPosDraft<L>> {
  if (!raw) return {};
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!d || typeof d !== "object") return {};
  const saved = d as Record<string, unknown>;
  const text = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
  return {
    lines: Array.isArray(saved.lines) && saved.lines.length ? (saved.lines as L[]) : undefined,
    plate: text(saved.plate),
    province: text(saved.province),
    mileage: text(saved.mileage),
    note: text(saved.note),
    billDate: text(saved.billDate),
    carBrandId: text(saved.carBrandId),
    carModelId: text(saved.carModelId),
    carYear: text(saved.carYear),
    docType: saved.docType === "bill" || saved.docType === "quotation" ? saved.docType : undefined,
    discountKind:
      saved.discountKind === "thb" || saved.discountKind === "pct" ? saved.discountKind : undefined,
    discountValue: text(saved.discountValue),
    customerName: text(saved.customerName),
    phones:
      Array.isArray(saved.phones) &&
      saved.phones.length > 0 &&
      saved.phones.every((p) => typeof p === "string")
        ? (saved.phones as string[])
        : undefined,
    billLang: saved.billLang === "th" || saved.billLang === "en" ? saved.billLang : undefined,
    billStyle:
      saved.billStyle === "invoice" || saved.billStyle === "thermal" ? saved.billStyle : undefined,
  };
}

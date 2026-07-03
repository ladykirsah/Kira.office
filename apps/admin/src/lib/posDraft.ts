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

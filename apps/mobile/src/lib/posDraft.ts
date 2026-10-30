import { partLine, serviceLine, type OpenDraft, type ProductRow } from "./posApi";
import type { BillState, PosLine } from "./posBill";

/**
 * A parked bill or quotation back on the bill page, exactly as it was saved: its own prices and
 * quantities, the discount as typed, and a quotation's QT number (it never changes). Stock and photos
 * come from today's product list; a part no longer listed stays on the bill with no stock, so paying
 * stops at it instead of it vanishing.
 */
export function billFromDraft(
  d: OpenDraft,
  products: readonly ProductRow[],
  key: () => string,
): { bill: BillState; quoteNumber: string | null } {
  const byVariant = new Map(products.map((p) => [p.variantId, p]));
  const lines: PosLine[] = d.lines.map((l) => {
    if (l.lineType === "service") {
      return {
        ...serviceLine({ name: l.description, priceSatang: l.unitPriceSatang }, key()),
        quantity: l.quantity,
      };
    }
    const p = l.productVariantId ? byVariant.get(l.productVariantId) : undefined;
    const base: PosLine = p
      ? partLine(p, "customer", key())
      : {
          ...serviceLine({ name: l.description, priceSatang: l.unitPriceSatang }, key()),
          kind: "part",
          variantId: l.productVariantId,
          costSatang: l.unitCostSatang ?? 0,
          onHand: 0,
        };
    return {
      ...base,
      barcode: l.barcodeValue ?? null,
      quantity: l.quantity,
      priceSatang: l.unitPriceSatang,
      useMechanic: base.mechanicSatang > 0 && l.unitPriceSatang === base.mechanicSatang,
    };
  });
  const mechanic = Boolean(d.buyerName?.trim());
  return {
    quoteNumber: d.stage === "quotation" ? d.saleNumber : null,
    bill: {
      doc: d.stage === "quotation" ? "quote" : "bill",
      buyer: mechanic ? "mechanic" : "customer",
      plate: d.licensePlate ?? "",
      province: "",
      customerName: "",
      phones: [],
      car: d.vehicle ?? "",
      mileage: d.mileageKm != null ? d.mileageKm.toLocaleString("en-US") : "",
      mechanicName: d.buyerName ?? "",
      lines,
      discount: { kind: d.discountKind === "pct" ? "pct" : "thb", value: d.discountValue ?? "" },
      note: d.notes ?? "",
    },
  };
}

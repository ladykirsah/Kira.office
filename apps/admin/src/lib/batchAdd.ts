/**
 * "Save" batch-listing rules for the Add-product page: after a save, the per-product
 * fields reset while the batch fields (part taxonomy + fitments) carry over, so entering a run of
 * similar parts (e.g. 20 compressors for the same models) never re-selects the same dropdowns.
 */

export interface BatchPart {
  brand: string;
  usage: string;
  type: string;
}

export interface ClearedProductFields {
  name: string;
  description: string;
  stockQty: string;
  weightKg: string;
  widthCm: string;
  lengthCm: string;
  heightCm: string;
  productRef: string;
  shopeeItemId: string;
  pricing: {
    costThb: string;
    taxOnCost: boolean;
    b2cThb: string;
    b2bThb: string;
    onlineThb: string;
    onlineCommPct: string;
  };
}

/** Fresh values for everything that must NOT leak from one product into the next. */
export function clearedProductFields(): ClearedProductFields {
  return {
    name: "",
    description: "",
    stockQty: "0",
    weightKg: "",
    widthCm: "",
    lengthCm: "",
    heightCm: "",
    productRef: "",
    shopeeItemId: "",
    pricing: {
      costThb: "",
      taxOnCost: false,
      b2cThb: "",
      b2bThb: "",
      onlineThb: "",
      onlineCommPct: "",
    },
  };
}

/** Label for the "carried over from the last product" pill; null when nothing is carried. */
export function carrySummary(part: BatchPart, fitmentCount: number): string | null {
  const bits = [part.brand, part.type].filter((s) => s.trim().length > 0);
  if (fitmentCount > 0) bits.push(`${fitmentCount} รุ่นรถ`);
  return bits.length > 0 ? bits.join(" · ") : null;
}

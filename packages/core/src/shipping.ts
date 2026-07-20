/**
 * Domestic parcel shipping-fee calculation for the AirPlus storefront.
 *
 * The engine here is a thin local replica of a courier's published rate table:
 * it bills the greater of a parcel's actual weight and its volumetric weight,
 * looks the result up in a weight-tier table, and adds a flat surcharge for
 * remote destinations. It takes the rate card as an argument and is pure — the
 * real Flash numbers live in a separate, owner-confirmable data module so the
 * calculation logic can be tested independently of the current price list.
 */

export interface ParcelDims {
  widthMm: number | null;
  lengthMm: number | null;
  heightMm: number | null;
}

export interface RateTier {
  /** Inclusive upper bound of chargeable weight, in kg. */
  uptoKg: number;
  feeSatang: number;
}

export interface ShippingRateCard {
  /** Ascending by `uptoKg`; the last entry is the heaviest flat tier. */
  tiers: RateTier[];
  /** Charge per whole kg ABOVE the heaviest tier's `uptoKg`. */
  overflowPerKgSatang: number;
  /** Volumetric divisor, applied to dimensions in cm (Flash uses 5000). */
  volumetricDivisor: number;
  /** Flat surcharge added when the destination postcode is remote. */
  remoteSurchargeSatang: number;
}

export interface ShippableItem {
  weightGrams: number;
  dims: ParcelDims | null;
  qty: number;
}

/**
 * Volumetric ("dimensional") weight in kg: (w × l × h in cm) / divisor.
 * Returns 0 when any dimension is missing or non-positive — a parcel we can't
 * measure contributes no volumetric weight and is priced on actual weight alone.
 */
export function volumetricWeightKg(dims: ParcelDims | null, divisor: number): number {
  if (!dims) return 0;
  const { widthMm, lengthMm, heightMm } = dims;
  if (widthMm == null || lengthMm == null || heightMm == null) return 0;
  if (widthMm <= 0 || lengthMm <= 0 || heightMm <= 0) return 0;
  const cm3 = (widthMm / 10) * (lengthMm / 10) * (heightMm / 10);
  return cm3 / divisor;
}

/** Chargeable weight of a single unit: the greater of actual vs volumetric. */
export function chargeableWeightKg(
  actualGrams: number,
  dims: ParcelDims | null,
  divisor: number,
): number {
  const actualKg = Math.max(0, actualGrams) / 1000;
  return Math.max(actualKg, volumetricWeightKg(dims, divisor));
}

/**
 * Dimensions of the single carton a cart is packed into, per the owner's rule
 * (confirmed 2026-07-20): items are stacked so one face of each touches, and
 * each is laid on its LARGEST face. So an item contributes its smallest
 * dimension to the stack height, and the carton's footprint is the largest
 * footprint in the cart.
 *
 *   combined = max(d1) x max(d2) x SUM(d3 x qty)   where d1 >= d2 >= d3 per item
 *
 * This deliberately counts the void space that summing each item's own volume
 * ignores — a small item sitting on a large one still ships inside the large
 * one's footprint. It is therefore never cheaper than summing volumes, and for
 * identical items it is exactly qty x the single-item volume.
 *
 * Items with unknown or non-positive dimensions are skipped (they cannot be
 * stacked); `null` means nothing in the cart was measurable, and the caller
 * should price on actual weight alone.
 */
export function packedParcelDims(
  items: readonly { dims: ParcelDims | null; qty: number }[],
): ParcelDims | null {
  let footprintLong = 0;
  let footprintShort = 0;
  let stackHeight = 0;
  let measurable = false;

  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.qty));
    if (qty <= 0) continue;
    const d = item.dims;
    if (!d) continue;
    const { widthMm, lengthMm, heightMm } = d;
    if (widthMm == null || lengthMm == null || heightMm == null) continue;
    if (widthMm <= 0 || lengthMm <= 0 || heightMm <= 0) continue;

    // Largest face is the two biggest dimensions; the smallest is the stack axis.
    const sorted = [widthMm, lengthMm, heightMm].sort((a, b) => b - a);
    const [d1 = 0, d2 = 0, d3 = 0] = sorted;
    measurable = true;
    footprintLong = Math.max(footprintLong, d1);
    footprintShort = Math.max(footprintShort, d2);
    stackHeight += d3 * qty;
  }

  if (!measurable) return null;
  return { widthMm: footprintLong, lengthMm: footprintShort, heightMm: stackHeight };
}

/**
 * Chargeable weight of a whole cart, treated as ONE combined parcel: the greater
 * of the summed actual weights and the volumetric weight of the packed carton
 * (see `packedParcelDims`). Each line is scaled by its qty.
 */
export function cartChargeableWeightKg(items: ShippableItem[], divisor: number): number {
  let totalActualKg = 0;
  for (const item of items) {
    const qty = Math.max(0, item.qty);
    totalActualKg += (Math.max(0, item.weightGrams) / 1000) * qty;
  }
  const packedKg = volumetricWeightKg(packedParcelDims(items), divisor);
  return Math.max(totalActualKg, packedKg);
}

/**
 * Fee for a given chargeable weight: the first tier whose `uptoKg` bound the
 * weight fits under, or the heaviest tier plus a per-whole-kg overflow charge
 * for anything above it. Weight at or below 0 still pays the base tier — every
 * order is at least one parcel.
 */
export function feeForChargeableKg(chargeableKg: number, card: ShippingRateCard): number {
  const tiers = card.tiers;
  const top = tiers[tiers.length - 1];
  if (!top) return 0; // empty rate card — no tiers to price against
  for (const tier of tiers) {
    if (chargeableKg <= tier.uptoKg) return tier.feeSatang;
  }
  const overflowKg = Math.ceil(chargeableKg - top.uptoKg);
  return top.feeSatang + overflowKg * card.overflowPerKgSatang;
}

/** Full quote in satang for a cart to a (possibly remote) destination. */
export function quoteShippingSatang(
  items: ShippableItem[],
  isRemote: boolean,
  card: ShippingRateCard,
): number {
  const chargeableKg = cartChargeableWeightKg(items, card.volumetricDivisor);
  const base = feeForChargeableKg(chargeableKg, card);
  return base + (isRemote ? card.remoteSurchargeSatang : 0);
}

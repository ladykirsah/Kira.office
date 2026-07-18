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
 * Chargeable weight of a whole cart, treated as ONE combined parcel:
 * the greater of the summed actual weights and the summed volumetric weights
 * (the owner's confirmed multi-item rule). Each line is scaled by its qty.
 */
export function cartChargeableWeightKg(items: ShippableItem[], divisor: number): number {
  let totalActualKg = 0;
  let totalVolumetricKg = 0;
  for (const item of items) {
    const qty = Math.max(0, item.qty);
    totalActualKg += (Math.max(0, item.weightGrams) / 1000) * qty;
    totalVolumetricKg += volumetricWeightKg(item.dims, divisor) * qty;
  }
  return Math.max(totalActualKg, totalVolumetricKg);
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

import { heldUntil, type CouponAppliesTo, type CouponLine, type CouponScope } from "@l-shopee/core";

/**
 * The cart as the coupon rules read it (owner, 1 Nov 2026): each line's amount at the price checkout
 * charges, whether a แฟลชเซล priced it (a coupon never cuts a flash price), and what the product is
 * — its brand, category and the car models it fits — for coupons that are only for some products.
 */
export interface CouponCartLine {
  qty: number;
  priceSatang: number;
  onFlashSale: boolean;
  productId: string;
  brandId: string | null;
  categoryId: string | null;
  carModelIds: string[];
}

export function couponLinesOf(lines: readonly CouponCartLine[]): CouponLine[] {
  return lines.map((l) => ({
    subtotalSatang: l.priceSatang * l.qty,
    onFlashSale: l.onFlashSale,
    productId: l.productId,
    brandId: l.brandId,
    categoryId: l.categoryId,
    carModelIds: l.carModelIds,
  }));
}

/** `[{ variantId, qty }]` from a request body; null for anything else. */
export function parseCartLines(input: unknown): { variantId: string; qty: number }[] | null {
  if (!Array.isArray(input)) return null;
  const out: { variantId: string; qty: number }[] = [];
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) return null;
    const { variantId, qty } = raw as Record<string, unknown>;
    if (typeof variantId !== "string" || !variantId) return null;
    if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 1) return null;
    out.push({ variantId, qty: Math.floor(qty) });
  }
  return out;
}

export interface HeldCouponRow {
  code: string;
  type: "fixed" | "percent";
  value: number;
  minSubtotalSatang: number;
  maxDiscountSatang: number | null;
  appliesTo: CouponAppliesTo;
  scope: CouponScope;
  signupFrom: number | null;
  signupTo: number | null;
  validDays: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number;
  /** redemptions by everyone, and by this customer */
  total: number;
  byCustomer: number;
}

export interface MyCoupon {
  code: string;
  type: "fixed" | "percent";
  value: number;
  minSubtotalSatang: number;
  maxDiscountSatang: number | null;
  appliesTo: CouponAppliesTo;
  scope: CouponScope;
  expiresAt: number;
  usesLeft: number;
}

/**
 * The coupons a customer holds (owner, 1 Nov 2026: ลูกค้าใหม่ coupons land on My coupons): each one
 * their account earned by joining in its window, until a year after they joined, while they still
 * have a use left and the coupon is not used up. Soonest to end first.
 */
export function myCoupons(
  rows: readonly HeldCouponRow[],
  joinedAt: number,
  now: number,
): MyCoupon[] {
  return rows
    .flatMap((r) => {
      const expiresAt = heldUntil(
        { ...r, startsAt: null, endsAt: null, status: "active" },
        {
          createdAt: joinedAt,
        },
      );
      const usesLeft = r.maxUsesPerCustomer - r.byCustomer;
      const usedUp = r.maxUses != null && r.total >= r.maxUses;
      if (expiresAt == null || expiresAt <= now || usesLeft <= 0 || usedUp) return [];
      return [
        {
          code: r.code,
          type: r.type,
          value: r.value,
          minSubtotalSatang: r.minSubtotalSatang,
          maxDiscountSatang: r.maxDiscountSatang,
          appliesTo: r.appliesTo,
          scope: r.scope,
          expiresAt,
          usesLeft,
        },
      ];
    })
    .sort((a, b) => a.expiresAt - b.expiresAt);
}

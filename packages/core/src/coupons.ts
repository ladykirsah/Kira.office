/**
 * Member-only coupon codes — the owner's chosen member-pricing mechanism (no self-serve B2B
 * tier; garages negotiate via LINE OA). Pure validation + discount math; D1 orchestration
 * (usage counts, redemption rows) lives at the callers.
 */

export interface Coupon {
  code: string;
  /** 'fixed' → value is satang off; 'percent' → value is basis points (10% = 1000). */
  type: "fixed" | "percent";
  value: number;
  minSubtotalSatang: number;
  startsAt: number | null;
  endsAt: number | null;
  /** null = unlimited total redemptions. */
  maxUses: number | null;
  maxUsesPerCustomer: number;
  status: "active" | "disabled";
}

export interface CouponUsage {
  /** total redemptions across all customers */
  total: number;
  /** redemptions by the redeeming customer */
  byCustomer: number;
}

export type CouponVerdict =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_found"
        | "disabled"
        | "not_started"
        | "expired"
        | "min_subtotal"
        | "exhausted"
        | "customer_limit";
    };

export function validateCoupon(
  coupon: Coupon | null | undefined,
  subtotalSatang: number,
  now: number,
  usage: CouponUsage,
): CouponVerdict {
  if (!coupon) return { ok: false, reason: "not_found" };
  if (coupon.status !== "active") return { ok: false, reason: "disabled" };
  if (coupon.startsAt !== null && now < coupon.startsAt)
    return { ok: false, reason: "not_started" };
  if (coupon.endsAt !== null && now >= coupon.endsAt) return { ok: false, reason: "expired" };
  if (subtotalSatang < coupon.minSubtotalSatang) return { ok: false, reason: "min_subtotal" };
  if (coupon.maxUses !== null && usage.total >= coupon.maxUses)
    return { ok: false, reason: "exhausted" };
  if (usage.byCustomer >= coupon.maxUsesPerCustomer) return { ok: false, reason: "customer_limit" };
  return { ok: true };
}

/** Discount in whole satang, always capped at the subtotal (a total can never go negative). */
export function couponDiscountSatang(coupon: Coupon, subtotalSatang: number): number {
  const raw =
    coupon.type === "fixed" ? coupon.value : Math.round((subtotalSatang * coupon.value) / 10000);
  return Math.min(raw, subtotalSatang);
}

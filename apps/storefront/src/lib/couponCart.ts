import {
  couponForLine,
  heldUntil,
  type CouponAppliesTo,
  type CouponLine,
  type CouponScope,
  type CouponWords,
} from "@l-shopee/core";

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

/** What every coupon shown to a customer carries, on My coupons and on the coupon list alike. */
interface CouponShown {
  code: string;
  /** The coupon's name as set in CrewEngine. */
  name: string;
  type: "fixed" | "percent";
  value: number;
  minSubtotalSatang: number;
  maxDiscountSatang: number | null;
  appliesTo: CouponAppliesTo;
  scope: CouponScope;
  /** The names of what it is for (brands, categories, car models or products); empty for all. */
  targets: string[];
  /** สำหรับทุกออเดอร์ · สำหรับสินค้า DENSO — the same words CrewEngine's coupon card says. */
  forLine: CouponWords;
  usesLeft: number;
}

export interface HeldCouponRow {
  code: string;
  name: string;
  type: "fixed" | "percent";
  value: number;
  minSubtotalSatang: number;
  maxDiscountSatang: number | null;
  appliesTo: CouponAppliesTo;
  scope: CouponScope;
  targets: string[];
  signupFrom: number | null;
  signupTo: number | null;
  validDays: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number;
  /** redemptions by everyone, and by this customer */
  total: number;
  byCustomer: number;
}

export interface MyCoupon extends CouponShown {
  expiresAt: number;
}

/** The part every listed coupon shares, from its row. */
function shown(
  r: Omit<CouponShown, "forLine" | "usesLeft"> & { signupFrom: number | null },
  usesLeft: number,
): CouponShown {
  return {
    code: r.code,
    name: r.name,
    type: r.type,
    value: r.value,
    minSubtotalSatang: r.minSubtotalSatang,
    maxDiscountSatang: r.maxDiscountSatang,
    appliesTo: r.appliesTo,
    scope: r.scope,
    targets: r.targets,
    forLine: couponForLine({ scope: r.scope, names: r.targets, signupFrom: r.signupFrom }),
    usesLeft,
  };
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
      return [{ ...shown(r, usesLeft), expiresAt }];
    })
    .sort((a, b) => a.expiresAt - b.expiresAt);
}

/** A coupon the owner put on the website (แสดงบนเว็บ on, not a ลูกค้าใหม่ coupon), with its counts. */
export interface WebCouponRow extends Omit<CouponShown, "forLine" | "usesLeft"> {
  startsAt: number | null;
  endsAt: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number;
  /** redemptions by everyone, and by this customer (0 when nobody is signed in) */
  total: number;
  byCustomer: number;
}

export interface WebCoupon extends CouponShown {
  /** null = no end date. */
  endsAt: number | null;
}

/** Sorts a coupon with no end date after every dated one (two of them compare equal, never NaN). */
const NO_END = Number.MAX_SAFE_INTEGER;

/**
 * The website's coupon list (plan 8.7, owner's pick A, 17 Nov 2026): every coupon with แสดงบนเว็บ on
 * that can be used right now — started, not ended, not used up, and with a use left for this
 * customer. Ending soonest first; no end date last.
 */
export function webCoupons(rows: readonly WebCouponRow[], now: number): WebCoupon[] {
  return rows
    .flatMap((r) => {
      const usesLeft = r.maxUsesPerCustomer - r.byCustomer;
      const started = r.startsAt == null || r.startsAt <= now;
      const ended = r.endsAt != null && r.endsAt <= now;
      const usedUp = r.maxUses != null && r.total >= r.maxUses;
      if (!started || ended || usedUp || usesLeft <= 0) return [];
      return [{ ...shown({ ...r, signupFrom: null }, usesLeft), endsAt: r.endsAt }];
    })
    .sort((a, b) => (a.endsAt ?? NO_END) - (b.endsAt ?? NO_END));
}

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
  /**
   * Largest discount this coupon may ever give, in satang. null = uncapped.
   * Exists for percent coupons: "10% off" on a ฿30,000 compressor is ฿3,000 off, which can wipe
   * out the margin on one order. The cap bounds the loss without lowering the headline percentage.
   */
  maxDiscountSatang: number | null;
  status: "active" | "disabled";
  /** What it cuts: the products (default) or the shipping fee (ส่งฟรี = 100% off shipping). */
  appliesTo?: CouponAppliesTo;
  /** ใช้กับ: every product (default), or only those of these brands / categories / car models / picks. */
  scope?: CouponScope;
  /** The brand, category (product type), car model or product ids the scope names. */
  targets?: readonly string[];
  /**
   * ลูกค้าใหม่: only accounts made between these two moments hold it, each for `validDays` from the
   * day the account was made, on any order (owner, 1 Nov 2026). null = everyone.
   */
  signupFrom?: number | null;
  signupTo?: number | null;
  validDays?: number | null;
}

export type CouponAppliesTo = "order" | "shipping";
export type CouponScope = "all" | "brand" | "category" | "car_model" | "products";

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
        | "customer_limit"
        | "not_eligible"
        | "no_items"
        | "flash_only";
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

/**
 * Discount in whole satang. Bounded twice: by the coupon's own max cap (when set), and always by
 * the subtotal — a total can never go negative.
 */
export function couponDiscountSatang(coupon: Coupon, subtotalSatang: number): number {
  const raw =
    coupon.type === "fixed" ? coupon.value : Math.round((subtotalSatang * coupon.value) / 10000);
  const capped =
    coupon.maxDiscountSatang != null && coupon.maxDiscountSatang >= 0
      ? Math.min(raw, coupon.maxDiscountSatang)
      : raw;
  return Math.min(capped, subtotalSatang);
}

const DAY_MS = 86_400_000;
/** A ลูกค้าใหม่ coupon lasts a year from the day the account was made (owner, 1 Nov 2026). */
const NEW_CUSTOMER_DAYS = 365;

/** One cart line as a coupon sees it: its amount, whether a แฟลชเซล priced it, and what it is. */
export interface CouponLine {
  subtotalSatang: number;
  onFlashSale: boolean;
  productId: string;
  brandId: string | null;
  categoryId: string | null;
  carModelIds: readonly string[];
}

function inScope(coupon: Coupon, line: CouponLine): boolean {
  const targets = coupon.targets ?? [];
  switch (coupon.scope ?? "all") {
    case "brand":
      return line.brandId != null && targets.includes(line.brandId);
    case "category":
      return line.categoryId != null && targets.includes(line.categoryId);
    case "car_model":
      return line.carModelIds.some((id) => targets.includes(id));
    case "products":
      return targets.includes(line.productId);
    default:
      return true;
  }
}

const madeInWindow = (coupon: Coupon, createdAt: number) =>
  coupon.signupFrom != null &&
  coupon.signupTo != null &&
  createdAt >= coupon.signupFrom &&
  createdAt <= coupon.signupTo;

/** ลูกค้าใหม่: whether this account holds the coupon now (made in the window, within its days). */
function holderProblem(
  coupon: Coupon,
  now: number,
  holder?: { createdAt: number },
): "not_eligible" | "expired" | null {
  if (coupon.signupFrom == null || coupon.signupTo == null) return null;
  if (!holder || !madeInWindow(coupon, holder.createdAt)) return "not_eligible";
  if (now >= holder.createdAt + (coupon.validDays ?? NEW_CUSTOMER_DAYS) * DAY_MS) return "expired";
  return null;
}

/**
 * The whole coupon check for a cart. A coupon never cuts a แฟลชเซล price (owner, 1 Nov 2026): those
 * lines neither get the discount nor count toward the minimum spend. ส่งฟรี / ลดค่าส่ง cut the
 * shipping fee instead, so a cart of flash-priced items can still use them. ใช้กับ narrows the
 * lines to a brand, category, car model or picked products.
 */
export function applyCoupon(
  coupon: Coupon | null | undefined,
  lines: readonly CouponLine[],
  shippingSatang: number,
  now: number,
  usage: CouponUsage,
  holder?: { createdAt: number },
): { ok: true; discountSatang: number } | Extract<CouponVerdict, { ok: false }> {
  if (!coupon) return { ok: false, reason: "not_found" };
  const shipping = coupon.appliesTo === "shipping";
  const matching = lines.filter((l) => inScope(coupon, l));
  const covered = shipping ? matching : matching.filter((l) => !l.onFlashSale);
  const subtotal = covered.reduce((sum, l) => sum + l.subtotalSatang, 0);
  const verdict = validateCoupon(coupon, subtotal, now, usage);
  if (!verdict.ok && verdict.reason !== "min_subtotal") return verdict;
  const held = holderProblem(coupon, now, holder);
  if (held) return { ok: false, reason: held };
  if (covered.length === 0) {
    return { ok: false, reason: matching.length > 0 ? "flash_only" : "no_items" };
  }
  if (!verdict.ok) return verdict;
  return {
    ok: true,
    discountSatang: couponDiscountSatang(coupon, shipping ? shippingSatang : subtotal),
  };
}

/**
 * A ลูกค้าใหม่ coupon on a customer's My coupons page: theirs when their account was made inside the
 * window, until `validDays` after that (a year unless set otherwise). null = not a coupon they hold.
 */
export function heldUntil(coupon: Coupon, holder: { createdAt: number }): number | null {
  if (!madeInWindow(coupon, holder.createdAt)) return null;
  return holder.createdAt + (coupon.validDays ?? NEW_CUSTOMER_DAYS) * DAY_MS;
}

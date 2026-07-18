import { baht } from "./format";

/**
 * Shared request/response contract for POST /api/checkout and POST /api/coupons/check —
 * imported by BOTH the client checkout page and the server route handlers so the two sides
 * can never drift apart. All money is integer satang.
 *
 * v2: purchasing requires login. The customer identity comes from the session cookie — the
 * body carries only what the account doesn't know yet (first-checkout name, a new address).
 */

export type CheckoutPaymentMethod = "promptpay" | "transfer" | "cod";

/** Client-generated once per checkout attempt; retries re-send the same ref → idempotent. */
export const IDEMPOTENCY_REF_PATTERN = /^AP-[A-Z0-9]{6,12}$/;

export interface CheckoutAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
}

export interface CheckoutRequest {
  /** Matches IDEMPOTENCY_REF_PATTERN, e.g. "AP-7KQ2M9XT". */
  idempotencyRef: string;
  /** Required ONLY when the logged-in account has no name yet (captured once, never overwritten). */
  name?: string;
  /** A saved address id owned by the logged-in customer. Exactly one of addressId | address. */
  addressId?: string;
  /** A new address — saved to the customer's address book as part of the order. */
  address?: CheckoutAddress;
  paymentMethod: CheckoutPaymentMethod;
  /** Optional coupon code — validated server-side against coupons + redemptions. */
  couponCode?: string;
  /** 1..20 lines; qty integer 1..99. Prices are NEVER sent — the server re-prices from D1. */
  lines: { variantId: string; qty: number }[];
}

export interface CheckoutSuccess {
  ref: string;
  orderId: string;
  paymentMethod: CheckoutPaymentMethod;
  /** Grand total AFTER discount and INCLUDING shipping — the amount the customer actually pays. */
  amountSatang: number;
  /** Shipping fee included in amountSatang (0 = free / not charged). */
  shippingSatang: number;
  /** Default PromptPay target from shop settings; null when the shop hasn't configured one. */
  promptpayId: string | null;
  itemCount: number;
  createdAt: number;
  /** Coupon discount applied to this order (0 = no coupon). */
  discountSatang: number;
  /** The applied coupon's code — present only when a coupon was redeemed. */
  couponCode?: string;
}

export interface CheckoutFailure {
  /** Thai, customer-readable. */
  error: string;
  /** true → no valid session; the client should surface the login section. */
  requiresLogin?: boolean;
}

export type CheckoutResponse = CheckoutSuccess | CheckoutFailure;

/* ---- POST /api/coupons/check (live coupon feedback in the cart summary) ---- */

export interface CouponCheckRequest {
  code: string;
  subtotalSatang: number;
}

export type CouponCheckResponse =
  | { valid: true; discountSatang: number; message: string }
  | { valid: false; message: string; requiresLogin?: boolean };

/** Failure reasons from @l-shopee/core validateCoupon (mirrored to avoid a runtime dep here). */
export type CouponFailReason =
  | "not_found"
  | "disabled"
  | "not_started"
  | "expired"
  | "min_subtotal"
  | "exhausted"
  | "customer_limit";

/** Thai, customer-readable message for a failed coupon validation (shared by both routes). */
export function couponReasonThai(reason: CouponFailReason, minSubtotalSatang: number): string {
  switch (reason) {
    case "not_found":
    case "disabled":
      return "ไม่พบคูปองนี้";
    case "not_started":
      return "คูปองยังไม่เริ่มใช้งาน";
    case "expired":
      return "คูปองหมดอายุแล้ว";
    case "min_subtotal":
      return `ยอดขั้นต่ำไม่ถึง (${baht(minSubtotalSatang)})`;
    case "exhausted":
      return "คูปองถูกใช้ครบแล้ว";
    case "customer_limit":
      return "คุณใช้คูปองนี้ครบสิทธิ์แล้ว";
  }
}

import { couponDiscountSatang, validateCoupon } from "@l-shopee/core";
import { getSession, guardMutation, takeThrottle } from "@/lib/auth";
import { couponReasonThai, type CouponCheckResponse } from "@/lib/checkoutApi";
import { getCouponWithUsage, getDb } from "@/lib/db";
import { baht } from "@/lib/format";

/**
 * POST /api/coupons/check — live "does this coupon work for my cart?" feedback for the checkout
 * summary. Read-only (the redemption row is only written by /api/checkout), session-required,
 * and per-customer throttled so it can't be used to brute-force coupon codes.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;

    const customer = await getSession();
    if (!customer)
      return Response.json(
        {
          valid: false,
          message: "กรุณาเข้าสู่ระบบก่อนใช้คูปอง",
          requiresLogin: true,
        } satisfies CouponCheckResponse,
        { status: 401 },
      );

    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const code = typeof b.code === "string" ? b.code.trim() : "";
    const subtotalSatang =
      typeof b.subtotalSatang === "number" &&
      Number.isInteger(b.subtotalSatang) &&
      b.subtotalSatang >= 0
        ? b.subtotalSatang
        : null;
    if (!code || subtotalSatang === null)
      return Response.json(
        { valid: false, message: "กรุณากรอกรหัสคูปอง" } satisfies CouponCheckResponse,
        { status: 400 },
      );

    const db = await getDb();
    const now = Date.now();
    if (!(await takeThrottle(db, `coupon:cust:${customer.id}`, 10, 60_000, now)))
      return Response.json(
        {
          valid: false,
          message: "ตรวจสอบคูปองถี่เกินไป กรุณาลองใหม่ในอีก 1 นาที",
        } satisfies CouponCheckResponse,
        { status: 429 },
      );

    const found = await getCouponWithUsage(db, code, customer.id);
    if (!found)
      return Response.json({
        valid: false,
        message: couponReasonThai("not_found", 0),
      } satisfies CouponCheckResponse);
    const verdict = validateCoupon(found.coupon, subtotalSatang, now, found.usage);
    if (!verdict.ok)
      return Response.json({
        valid: false,
        message: couponReasonThai(verdict.reason, found.coupon.minSubtotalSatang),
      } satisfies CouponCheckResponse);

    const discountSatang = couponDiscountSatang(found.coupon, subtotalSatang);
    return Response.json({
      valid: true,
      discountSatang,
      message: `ใช้คูปองได้ ลด ${baht(discountSatang)}`,
    } satisfies CouponCheckResponse);
  } catch (err) {
    console.error("POST /api/coupons/check failed", err);
    return Response.json(
      {
        valid: false,
        message: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง",
      } satisfies CouponCheckResponse,
      { status: 500 },
    );
  }
}

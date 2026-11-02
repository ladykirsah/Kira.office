import {
  applyCoupon,
  FLASH_TH_RATE_CARD,
  FLASH_TH_REMOTE_POSTCODES,
  isRemotePostcode,
  quoteShippingSatang,
  resolveEffectivePrice,
} from "@l-shopee/core";
import { getSession, guardMutation, takeThrottle } from "@/lib/auth";
import { couponReasonThai, type CouponCheckResponse } from "@/lib/checkoutApi";
import { couponLinesOf, parseCartLines } from "@/lib/couponCart";
import { getCheckoutPricing, getCouponWithUsage, getDb } from "@/lib/db";
import { baht } from "@/lib/format";

/**
 * POST /api/coupons/check — live "does this coupon work for my cart?" feedback for the checkout
 * summary. Read-only (the redemption row is only written by /api/checkout), session-required,
 * and per-customer throttled so it can't be used to brute-force coupon codes. The cart is re-priced
 * here the way checkout prices it, so flash prices, ใช้กับ and ส่งฟรี answer the same as at payment.
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
    const lines = parseCartLines(b.lines);
    const postcode = typeof b.postcode === "string" ? b.postcode.trim() : "";
    if (!code || !lines)
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

    const pricing = await getCheckoutPricing(
      db,
      lines.map((l) => l.variantId),
      now,
    );
    const priced = lines.flatMap((l) => {
      const row = pricing.get(l.variantId);
      if (!row) return [];
      const eff = resolveEffectivePrice(row.priceSatang, row.campaign, now);
      return [{ ...row, qty: l.qty, priceSatang: eff.priceSatang, onFlashSale: eff.onSale }];
    });
    const knowsAddress = /^\d{5}$/.test(postcode);
    const shipping = knowsAddress
      ? quoteShippingSatang(
          priced.map((p) => ({
            weightGrams: p.weightGrams,
            dims: { widthMm: p.widthMm, lengthMm: p.lengthMm, heightMm: p.heightMm },
            qty: p.qty,
          })),
          isRemotePostcode(postcode, FLASH_TH_REMOTE_POSTCODES),
          FLASH_TH_RATE_CARD,
        )
      : 0;
    const out = applyCoupon(
      found.coupon,
      couponLinesOf(priced),
      shipping,
      now,
      found.usage,
      found.holder,
    );
    if (!out.ok)
      return Response.json({
        valid: false,
        message: couponReasonThai(out.reason, found.coupon.minSubtotalSatang),
      } satisfies CouponCheckResponse);

    const onShipping = found.coupon.appliesTo === "shipping";
    return Response.json({
      valid: true,
      discountSatang: out.discountSatang,
      message:
        onShipping && !knowsAddress
          ? "ใช้คูปองได้ ส่วนลดค่าส่งจะคิดเมื่อกรอกที่อยู่"
          : `ใช้คูปองได้ ลด ${baht(out.discountSatang)}`,
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

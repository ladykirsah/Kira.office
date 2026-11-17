import { getSession } from "@/lib/auth";
import { webCoupons } from "@/lib/couponCart";
import { getDb, listWebCouponRows } from "@/lib/db";

/**
 * GET /api/coupons — the website's coupon list (plan 8.7, owner's pick A, 17 Nov 2026): every coupon
 * the owner switched แสดงบนเว็บ on in CrewEngine that can be used right now, with its name and what it
 * is for. Open to everyone; a signed-in customer's own uses count, so one they have used up is left
 * out. Customers still use a coupon by its code at checkout, where /api/checkout checks it all again.
 * The website's coupon pages stay the old made-up list until the AirPlus redesign (board 11).
 */
export async function GET(): Promise<Response> {
  try {
    const customer = await getSession();
    const rows = await listWebCouponRows(await getDb(), customer?.id ?? null);
    return Response.json({ coupons: webCoupons(rows, Date.now()) });
  } catch (err) {
    console.error("GET /api/coupons failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
  }
}

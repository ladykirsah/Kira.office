import { getSession } from "@/lib/auth";
import { myCoupons } from "@/lib/couponCart";
import { getDb, listHeldCoupons } from "@/lib/db";

/**
 * GET /api/account/coupons — the signed-in customer's own coupons for My coupons (owner, 1 Nov
 * 2026): the ลูกค้าใหม่ coupons their account earned, each until a year after they joined. They use
 * one by its code at checkout, where /api/checkout checks it all again.
 */
export async function GET(): Promise<Response> {
  try {
    const customer = await getSession();
    if (!customer) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const held = await listHeldCoupons(await getDb(), customer.id);
    return Response.json({
      coupons: held ? myCoupons(held.rows, held.joinedAt, Date.now()) : [],
    });
  } catch (err) {
    console.error("GET /api/account/coupons failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
  }
}

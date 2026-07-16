import type { Metadata } from "next";
import { AvailableCoupons } from "./AvailableCoupons";

export const metadata: Metadata = { title: "คูปองส่วนลด — AirPlus" };
export const dynamic = "force-dynamic";

/** Coupon CATALOG (home shortcut → here): every available coupon, each with a "เก็บ" action that
 *  saves it to the shopper's wallet (/account/coupons). See lib/coupons.ts + AvailableCoupons.tsx. */
export default function CouponsPage() {
  return (
    <div>
      <section className="section" style={{ marginBottom: 16 }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)" }}>
          🎟️ คูปอง · Coupons
        </div>
        <h1 className="t-h1" style={{ color: "var(--gray-dark)", margin: "6px 0 8px" }}>
          คูปองส่วนลด
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          เก็บคูปองที่ต้องการ แล้วใช้ตอนชำระเงิน · ดูคูปองที่เก็บไว้ได้ในหน้า “คูปองของฉัน”
        </p>
      </section>
      <AvailableCoupons />
    </div>
  );
}

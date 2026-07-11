import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "คูปองส่วนลด — AirPlus" };

/** Placeholder coupons page — the member-coupon feature isn't built yet, but the home shortcut links
 *  here so it never dead-ends. Replace with the real coupon wallet when that feature ships. */
export default function CouponsPage() {
  return (
    <div>
      <section className="section" style={{ margin: "8px 0 16px" }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)" }}>
          🎟️ คูปอง · Coupons
        </div>
        <h1 className="t-h1" style={{ color: "var(--gray-dark)", margin: "6px 0 8px" }}>
          คูปองส่วนลด
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          เร็ว ๆ นี้ — เรากำลังเตรียมคูปองส่วนลดสำหรับลูกค้า กลับมาดูใหม่เร็ว ๆ นี้
        </p>
      </section>

      <section className="section">
        <div
          className="card"
          style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div className="t-h4" style={{ color: "var(--gray-dark)" }}>
            ระหว่างนี้เลือกซื้ออะไหล่ได้เลย
          </div>
          <p className="muted" style={{ margin: 0 }}>
            ตู้แอร์ คอมเพรสเซอร์ แผงร้อน และอะไหล่ระบบแอร์ ราคาช่าง ส่งไวทั่วไทย
          </p>
          <Link className="btn" href="/products" style={{ alignSelf: "flex-start" }}>
            เลือกซื้อสินค้า
          </Link>
        </div>
      </section>
    </div>
  );
}

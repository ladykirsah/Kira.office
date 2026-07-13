import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MyCoupons } from "./MyCoupons";

export const metadata: Metadata = { title: "คูปองของฉัน — AirPlus" };
export const dynamic = "force-dynamic";

/** MY coupons (account tile → here): the codes this member has collected from the /coupons catalog,
 *  ready to copy for checkout. Member-gated like the rest of /account; the wallet itself is client-
 *  side (see MyCoupons.tsx) until a member-scoped backend replaces the localStorage store. */
export default async function MyCouponsPage() {
  const customer = await getSession();
  if (!customer) redirect("/login?next=/account/coupons");

  return (
    <div>
      <section className="section" style={{ marginBottom: 16 }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)" }}>
          🎟️ คูปองของฉัน · My coupons
        </div>
        <h1 className="t-h1" style={{ color: "var(--gray-dark)", margin: "6px 0 8px" }}>
          คูปองของฉัน
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          คูปองที่คุณเก็บไว้ · คัดลอกโค้ดแล้วใช้ตอนชำระเงิน
        </p>
      </section>
      <MyCoupons />
    </div>
  );
}

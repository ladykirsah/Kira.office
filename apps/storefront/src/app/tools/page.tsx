import type { Metadata } from "next";
import { getDb, listAffiliateItems } from "@/lib/db";
import { AffiliateCard } from "@/components/AffiliateCard";

// Live affiliate data from D1 — must render per-request on the Worker, never prerender at build
// time (the build environment has no real database).
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "เครื่องมือช่าง — AirPlus" };

/** All active curated affiliate tools — every card exits through /go/:id (click-counted). */
export default async function ToolsPage() {
  const db = await getDb();
  const items = await listAffiliateItems(db, 50);
  return (
    <div>
      <section className="section" style={{ margin: "8px 0 16px" }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)" }}>
          🔧 เครื่องมือช่าง · Tools
        </div>
        <h1 className="t-h1" style={{ color: "var(--gray-dark)", margin: "0 0 6px" }}>
          เครื่องมือช่าง
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          เครื่องมือช่างแอร์ที่เราคัดมาแนะนำ — ลิงก์พาร์ทเนอร์ สั่งซื้อบนแพลตฟอร์มปลายทาง
        </p>
      </section>

      {items.length > 0 ? (
        <div className="rec-grid">
          {items.map((item) => (
            <AffiliateCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <div className="t-h4" style={{ marginBottom: 6 }}>
            ยังไม่มีเครื่องมือแนะนำ
          </div>
          <p className="muted" style={{ margin: 0 }}>
            เรากำลังคัดเครื่องมือดี ๆ มาให้ กลับมาดูใหม่เร็ว ๆ นี้
          </p>
        </div>
      )}
    </div>
  );
}

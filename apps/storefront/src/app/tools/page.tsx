import type { Metadata } from "next";
import Link from "next/link";
import { getDb, listFiledAffiliateItems } from "@/lib/db";
import { AffiliateCard } from "@/components/AffiliateCard";
import { ToolChips } from "@/components/ToolChips";
import { groupToolsByCategory } from "@/lib/toolGroups";

// Live affiliate data from D1 — must render per-request on the Worker, never prerender at build
// time (the build environment has no real database).
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "เครื่องมือช่าง — AirPlus" };

/**
 * Curated affiliate tools, one shelf per category (busiest category first). Every card exits
 * through /go/:id, which counts the click that decides this page's own ordering.
 *
 * The chip bar filters in place via ?cat=; ดูทั้งหมด goes to the real /tools/[slug] page, which is
 * what search engines index and what a customer can bookmark.
 */
export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const [db, params] = await Promise.all([getDb(), searchParams]);
  const sections = groupToolsByCategory(await listFiledAffiliateItems(db));

  const active = params.cat && sections.some((s) => s.slug === params.cat) ? params.cat : null;
  const shown = active ? sections.filter((s) => s.slug === active) : sections;

  return (
    <div>
      <section className="section" style={{ marginBottom: 16 }}>
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

      {sections.length > 1 && (
        <ToolChips
          chips={sections.map((s) => ({ slug: s.slug, name: s.name, total: s.total }))}
          active={active}
        />
      )}

      {shown.length > 0 ? (
        shown.map((section) => (
          <section className="section" key={section.slug} style={{ margin: "20px 0" }}>
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <h2 className="t-h3" style={{ color: "var(--gray-dark)", margin: 0 }}>
                  {section.name}
                </h2>
                <Link
                  href={`/tools/${encodeURIComponent(section.slug)}`}
                  style={{ color: "var(--brand-deep)", fontWeight: 400, fontSize: 13 }}
                >
                  ดูทั้งหมด ({section.total}) →
                </Link>
              </div>
            </div>
            {/* .tool-grid = 5 cols × 2 rows on desktop, 4 × 2 on tablet, a swipe rail on phones */}
            <div className="tool-grid">
              {section.items.map((item) => (
                <AffiliateCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))
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

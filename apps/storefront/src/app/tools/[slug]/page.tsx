import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, listFiledAffiliateItems } from "@/lib/db";
import { AffiliateCard } from "@/components/AffiliateCard";
import { matchCategorySlug } from "@/lib/toolSlug";

// Live affiliate data from D1 — per-request on the Worker, never prerendered at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  // Resolve the real category name rather than echoing the slug: the slug is lowercased and
  // dashed, and "gauges — …" in the tab and in search results is not what the category is called.
  const [db, { slug }] = await Promise.all([getDb(), params]);
  const items = await listFiledAffiliateItems(db);
  const name = matchCategorySlug(
    items.map((i) => i.categoryName).filter((n): n is string => !!n),
    decodeURIComponent(slug),
  );
  return { title: `${name ?? "เครื่องมือช่าง"} — เครื่องมือช่าง AirPlus` };
}

/**
 * One affiliate category in full — the ดูทั้งหมด target from /tools, and the URL a customer can
 * bookmark or a search engine can index. No cap here: this page IS the rest of the shelf.
 */
export default async function ToolCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const [db, { slug }] = await Promise.all([getDb(), params]);
  const all = await listFiledAffiliateItems(db);

  const name = matchCategorySlug(
    all.map((i) => i.categoryName).filter((n): n is string => !!n),
    decodeURIComponent(slug),
  );
  if (!name) notFound();

  const items = all.filter((i) => i.categoryName === name);

  return (
    <div>
      <section className="section" style={{ marginBottom: 16 }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)" }}>
          <Link href="/tools" style={{ color: "var(--brand-deep)" }}>
            🔧 เครื่องมือช่าง
          </Link>{" "}
          · {name}
        </div>
        <h1 className="t-h1" style={{ color: "var(--gray-dark)", margin: "0 0 6px" }}>
          {name}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {items.length} รายการ — ลิงก์พาร์ทเนอร์ สั่งซื้อบนแพลตฟอร์มปลายทาง
        </p>
      </section>

      <div className="rec-grid">
        {items.map((item) => (
          <AffiliateCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

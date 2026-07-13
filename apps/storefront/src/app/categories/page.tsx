import Link from "next/link";
import type { Metadata } from "next";
import { getDb, listProductTypes } from "@/lib/db";
import { PART_TYPE_EN } from "@/lib/labels";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "หมวดหมู่สินค้า · AirPlus" };

// Reads live D1 (product types + counts) → never statically prerender (D1 is unavailable at build).
export const dynamic = "force-dynamic";

/**
 * Full categories index (owner-approved "Design 2"): best-seller-style rows — cover + Thai name +
 * English + count + chevron. The home "ดูทั้งหมด →" on the category strip links here; each row opens
 * that category's products. Same in-stock filtering as the home strip (listProductTypes), so empty
 * categories never show.
 */
export default async function CategoriesPage() {
  const db = await getDb();
  const types = await listProductTypes(db);

  return (
    <div className="section" style={{ marginTop: 4 }}>
      <div style={{ marginBottom: 20 }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)", marginBottom: 6 }}>
          🗂️ หมวดหมู่ · Categories
        </div>
        <h1 className="t-h1" style={{ color: "var(--gray-dark)", margin: 0 }}>
          เลือกตามหมวดหมู่
        </h1>
      </div>
      {types.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ margin: 0, color: "var(--gray-mid)" }}>ยังไม่มีหมวดหมู่สินค้า</p>
        </div>
      ) : (
        <div className="catlist">
          {types.map((t) => (
            <Link
              key={t.id}
              href={`/products?type=${encodeURIComponent(t.id)}&ctx=cat`}
              className="catlist-row"
              aria-label={`ดูสินค้าในหมวด ${t.name} (${t.productCount} รายการ)`}
            >
              <div className="catlist-thumb">
                {/* categories have no photo yet → brand-orange ✦ placeholder (same as the home strip) */}
                <span aria-hidden="true" className="star">
                  ✦
                </span>
              </div>
              <div className="catlist-info">
                <div className="catlist-name">{t.name}</div>
                {PART_TYPE_EN[t.name] && (
                  <div className="catlist-name-en">{PART_TYPE_EN[t.name]}</div>
                )}
                <div className="catlist-count">{t.productCount} รายการ</div>
              </div>
              <span className="catlist-chev" aria-hidden="true">
                <Icon name="chevron" size={22} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { carBrandTiles, getDb } from "@/lib/db";
import { displayNames } from "@l-shopee/core";
import { resolveBrandLogo } from "@/lib/brandLogo";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "ยี่ห้อรถ · AirPlus" };

// Reads live D1 (car brands + counts) → never statically prerender (D1 is unavailable at build).
export const dynamic = "force-dynamic";

/**
 * Full car-brand index — the "ดูทั้งหมด" target for the home By-Brand strip. Same plain best-seller
 * rows as /categories (cover + Thai + English + count + chevron), but the cover shows the make logo
 * (✦ fallback). Each row opens that brand's products. Large limit → lists every brand, not the
 * home strip's short preview.
 */
export default async function BrandsPage() {
  const db = await getDb();
  const brands = await carBrandTiles(db, 64);

  return (
    <div className="section">
      <div style={{ marginBottom: 20 }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)", marginBottom: 6 }}>
          🚗 ยี่ห้อรถ · Car Fitment
        </div>
        <h1 className="t-h1" style={{ color: "var(--gray-dark)", margin: 0 }}>
          เลือกตามยี่ห้อรถ
        </h1>
      </div>
      {brands.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ margin: 0, color: "var(--gray-mid)" }}>ยังไม่มียี่ห้อรถ</p>
        </div>
      ) : (
        <div className="catlist">
          {brands.map((b) => {
            const n = displayNames({ name: b.brand, nameTh: b.nameTh, nameEn: b.nameEn });
            const th = n.th; // headline; n.en is the sub-line (null when there is nothing to add)
            const logo = resolveBrandLogo(b.brand, b.imageKey);
            return (
              <Link
                key={b.brand}
                href={`/products?carBrand=${encodeURIComponent(b.brand)}&ctx=brand`}
                className="catlist-row"
                aria-label={`ดูสินค้าสำหรับ ${th ?? b.brand} (${b.productCount} รายการ)`}
              >
                <div className="catlist-thumb">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt={th ?? b.brand} loading="lazy" />
                  ) : (
                    <span aria-hidden="true" className="star">
                      ✦
                    </span>
                  )}
                </div>
                <div className="catlist-info">
                  <div className="catlist-name">{th ?? b.brand}</div>
                  {th && <div className="catlist-name-en">{b.brand}</div>}
                  <div className="catlist-count">{b.productCount} รายการ</div>
                </div>
                <span className="catlist-chev" aria-hidden="true">
                  <Icon name="chevron" size={22} />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

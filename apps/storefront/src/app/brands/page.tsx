import Link from "next/link";
import type { Metadata } from "next";
import { carBrandTiles, getDb } from "@/lib/db";
import { CAR_BRAND_LOGO, CAR_BRAND_TH } from "@/lib/labels";

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
    <div className="section" style={{ marginTop: 4 }}>
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
            const th = CAR_BRAND_TH[b.brand]; // Thai headline, English becomes the sub-line
            const logo = CAR_BRAND_LOGO[b.brand];
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
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

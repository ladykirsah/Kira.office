import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveEffectivePrice } from "@l-shopee/core";
import { getDb, getProduct, listCatalog } from "@/lib/db";
import { baht } from "@/lib/format";
import { Countdown } from "@/components/Countdown";
import { ProductCard } from "@/components/ProductCard";
import { RecentlyViewed, RecordView } from "@/components/RecentlyViewed";
import { AddToCartBar } from "./AddToCartBar";
import { Gallery } from "./Gallery";

// Live catalog data from D1 — must render per-request on the Worker, never prerender at build
// time (the build environment has no real database).
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params;
  const db = await getDb();
  const detail = await getProduct(db, id);
  return { title: detail ? `${detail.name} — AirPlus` : "ไม่พบสินค้า — AirPlus" };
}

function fitmentLabel(f: {
  carBrand: string | null;
  carModel: string | null;
  yearFrom: number | null;
  yearTo: number | null;
}): string {
  const car = [f.carBrand, f.carModel].filter(Boolean).join(" ");
  if (f.yearFrom != null && f.yearTo != null) return `${car} (${f.yearFrom}–${f.yearTo})`;
  if (f.yearFrom != null) return `${car} (${f.yearFrom} ขึ้นไป)`;
  if (f.yearTo != null) return `${car} (ถึงปี ${f.yearTo})`;
  return car;
}

export default async function ProductPage(props: PageProps) {
  const { id } = await props.params;
  const db = await getDb();
  const detail = await getProduct(db, id);
  if (!detail) notFound();

  const metaLine = [detail.typeName, detail.brandName].filter(Boolean).join(" · ");
  const inStock = detail.onHand > 0;
  // Same core resolver as checkout — the price shown here can never disagree with re-pricing.
  const eff = resolveEffectivePrice(detail.priceSatang, detail.campaign, Date.now());

  // Related products: CatalogItem carries typeName but not typeId, and listCatalog's q does not
  // match type names — so one tiny lookup for the product's type_id, then the existing typeId
  // filter. No type (or a sparse one) falls back to the latest products. Self is excluded.
  const typeRow = await db
    .prepare(`SELECT type_id AS typeId FROM products WHERE id = ?`)
    .bind(id)
    .first<{ typeId: string | null }>();
  const relatedPool = typeRow?.typeId
    ? await listCatalog(db, { typeId: typeRow.typeId, limit: 8 })
    : await listCatalog(db, { limit: 12 });
  const related = relatedPool.filter((i) => i.productId !== detail.productId).slice(0, 4);

  return (
    <div className="has-sticky-bar">
      {/* mobile-first single column; ≥720px two-column gallery|info (same page widened) */}
      <style>{`
        .pdp-grid { display: grid; gap: 20px; }
        @media (min-width: 720px) {
          .pdp-grid { grid-template-columns: 1fr 1fr; gap: 32px; align-items: start; }
        }
      `}</style>

      <div className="pdp-grid">
        <Gallery images={detail.images} coverKey={detail.imageKey} name={detail.name} />

        <div>
          {metaLine && (
            <div className="t-overline" style={{ color: "var(--brand-deep)", marginBottom: 6 }}>
              {metaLine}
            </div>
          )}
          <h1 className="t-h1" style={{ margin: "0 0 8px", color: "var(--gray-dark)" }}>
            {detail.name}
          </h1>
          <div className="t-small" style={{ color: "var(--gray-mid)" }}>
            รหัสอะไหล่: {detail.productRef}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              flexWrap: "wrap",
              margin: "18px 0 10px",
            }}
          >
            <span className="t-price-l">{baht(eff.priceSatang)}</span>
            {eff.onSale && eff.compareAtSatang !== null && (
              <>
                <span className="t-price-strike">{baht(eff.compareAtSatang)}</span>
                <span
                  style={{
                    background: "var(--brand-deep)",
                    color: "var(--white)",
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "4px 10px",
                    borderRadius: 999,
                    letterSpacing: "0.02em",
                  }}
                >
                  ลด{" "}
                  {Math.round(
                    ((eff.compareAtSatang - eff.priceSatang) / eff.compareAtSatang) * 100,
                  )}
                  %
                </span>
              </>
            )}
            {detail.priceIncludesVat && (
              <span style={{ fontSize: 12, color: "var(--gray-mid)" }}>ราคารวม VAT 7% แล้ว</span>
            )}
          </div>

          {eff.onSale && eff.endsAt !== null && (
            <div
              style={{
                background: "var(--brand)",
                color: "var(--white)",
                fontSize: 13,
                fontWeight: 800,
                padding: "8px 12px",
                borderRadius: 999,
                margin: "0 0 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ⚡ แฟลชเซล — <Countdown endsAt={eff.endsAt} />
            </div>
          )}

          <span className={inStock ? "pill good" : "pill bad"} style={{ fontSize: 12 }}>
            {inStock ? "พร้อมส่ง" : "สินค้าหมด"}
          </span>

          {detail.fitments.length > 0 && (
            <section className="section">
              <div className="section-head">
                <div className="t-overline" style={{ color: "var(--brand-deep)" }}>
                  🔧 Fitment
                </div>
                <h2 className="t-h2">
                  <span style={{ color: "var(--brand)" }}>ใส่ได้กับ</span>รถ
                </h2>
              </div>
              <div
                style={{
                  padding: "4px 16px",
                  background: "var(--white)",
                  border: "1px solid var(--gray-lite)",
                  borderRadius: "var(--radius)",
                  boxShadow: "var(--shadow)",
                }}
              >
                {detail.fitments.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 0",
                      borderTop: i > 0 ? "1px solid var(--gray-lite)" : "none",
                      fontSize: 15,
                      color: "var(--gray-dark)",
                      fontWeight: 500,
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      style={{ flexShrink: 0, color: "var(--brand)" }}
                    >
                      <path
                        d="M5 12.5 10 17.5 19 7"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>{fitmentLabel(f)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {detail.description && (
            <section className="section">
              <div className="section-head">
                <div className="t-overline" style={{ color: "var(--brand-deep)" }}>
                  📋 Details
                </div>
                <h2 className="t-h2">รายละเอียดสินค้า</h2>
              </div>
              <p
                style={{
                  whiteSpace: "pre-line",
                  color: "var(--gray-dark)",
                  fontSize: 15,
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {detail.description}
              </p>
            </section>
          )}

          {detail.weightGrams > 0 && (
            <div style={{ fontSize: 12, color: "var(--gray-mid)", marginTop: 16 }}>
              น้ำหนักจัดส่ง ~{(detail.weightGrams / 1000).toFixed(1)} กก.
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div className="t-overline" style={{ color: "var(--brand-deep)" }}>
              🔥 สินค้าใกล้เคียง · Related
            </div>
            <h2 className="t-h2">สินค้าใกล้เคียง</h2>
          </div>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard key={item.variantId} item={item} />
            ))}
          </div>
        </section>
      )}

      <RecentlyViewed currentProductId={detail.productId} />
      <RecordView
        item={{
          productId: detail.productId,
          name: detail.name,
          priceSatang: eff.priceSatang,
          imageKey: detail.imageKey,
          productRef: detail.productRef,
          variantId: detail.variantId,
        }}
      />

      <AddToCartBar
        variantId={detail.variantId}
        productId={detail.productId}
        name={detail.name}
        productRef={detail.productRef}
        brandName={detail.brandName}
        priceSatang={eff.priceSatang}
        imageKey={detail.imageKey}
        onHand={detail.onHand}
      />
    </div>
  );
}

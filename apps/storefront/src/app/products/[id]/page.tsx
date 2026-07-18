import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveEffectivePrice } from "@l-shopee/core";
import { getDb, getProduct, listCatalog } from "@/lib/db";
import { baht } from "@/lib/format";
import { BrandTag } from "@/components/BrandTag";
import { Countdown } from "@/components/Countdown";
import { DiscountTag } from "@/components/DiscountTag";
import { Pill } from "@/components/Pill";
import { ProductCard } from "@/components/ProductCard";
import { ReadyToShip } from "@/components/ReadyToShip";
import { RecentlyViewed, RecordView } from "@/components/RecentlyViewed";
import { Icon } from "@/components/Icon";
import { AddToCartBar } from "./AddToCartBar";
import { CollapsibleSection } from "./CollapsibleSection";
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

/** Fitment split into two columns: "Toyota · Hilux Vigo" (brand · model) and the bare year range. */
function fitmentName(f: { carBrand: string | null; carModel: string | null }): string {
  return [f.carBrand, f.carModel].filter(Boolean).join(" · ");
}
function fitmentYear(f: { yearFrom: number | null; yearTo: number | null }): string {
  if (f.yearFrom != null && f.yearTo != null) return `${f.yearFrom}–${f.yearTo}`;
  if (f.yearFrom != null) return `${f.yearFrom} ขึ้นไป`;
  if (f.yearTo != null) return `ถึงปี ${f.yearTo}`;
  return "";
}

export default async function ProductPage(props: PageProps) {
  const { id } = await props.params;
  const db = await getDb();
  const detail = await getProduct(db, id);
  if (!detail) notFound();

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
        .pdp-grid { display: grid; gap: 0; }
        @media (max-width: 719px) {
          /* cancel .wrap's 16px top padding so the white gallery block fills up to the orange header */
          .pdp-grid { margin-top: -16px; }
        }
        @media (min-width: 720px) {
          .pdp-grid { grid-template-columns: 1fr 1fr; gap: 32px; align-items: start; }
        }
      `}</style>

      <div className="pdp-grid">
        <div className="pdp-gallery-cell">
          <Gallery images={detail.images} coverKey={detail.imageKey} name={detail.name} />
        </div>

        <div>
          {/* Design A — Shopee-style section blocks: white blocks separated by a thick gray band,
              full-bleed on mobile. รุ่นรถที่ใช้ได้ + คำอธิบาย collapse; the spec block stays open. */}
          <div className="pdp-blocks">
            {/* 1st block (white): pills · title · price · flash */}
            <div className="pdp-block">
              {/* category + brand (gray) + ready-to-ship (green) pills grouped in one row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                {/* gray = product details (category via shared Pill, brand via BrandTag); green = status */}
                {detail.typeName && (
                  <Pill color="var(--gray-mid)" background="rgba(115, 115, 115, 0.12)">
                    {detail.typeName}
                  </Pill>
                )}
                {detail.brandName && <BrandTag name={detail.brandName} />}
                {inStock && <ReadyToShip />}
              </div>
              {/* Semibold (not the token's 800) — long product names read lighter on the PDP. */}
              <h1
                className="t-h1"
                style={{ margin: "0 0 8px", color: "var(--gray-dark)", fontWeight: 600 }}
              >
                {detail.name}
              </h1>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  margin: "18px 0 10px",
                }}
              >
                <span className="t-price-l">{baht(eff.priceSatang)}</span>
                <DiscountTag priceSatang={eff.priceSatang} compareAtSatang={eff.compareAtSatang} />
              </div>

              {/* Flash-sale countdown — below the price. */}
              {eff.onSale && eff.endsAt !== null && (
                <div
                  style={{
                    background: "var(--brand)",
                    color: "var(--white)",
                    fontSize: 13,
                    fontWeight: 800,
                    padding: "8px 12px",
                    borderRadius: 999,
                    margin: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  ⚡ แฟลชเซล — <Countdown endsAt={eff.endsAt} />
                </div>
              )}
            </div>

            <div className="pdp-band" />

            {/* Details block — headline kept exactly (📋 รายละเอียด · Details) + current spec rows */}
            <div className="pdp-block">
              <div style={{ marginBottom: 16 }}>
                <div className="t-overline" style={{ color: "var(--brand-deep)", marginBottom: 6 }}>
                  📋 รายละเอียด · Details
                </div>
                <h2 className="t-h2" style={{ margin: 0, color: "var(--gray-dark)" }}>
                  รายละเอียดสินค้า
                </h2>
              </div>

              {/* spec rows (icon · label · value) */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {(
                  [
                    { ic: "🗂️", label: "หมวดหมู่", value: detail.typeName },
                    { ic: "🏷️", label: "แบรนด์", value: detail.brandName },
                    { ic: "#️⃣", label: "รหัสสินค้า", value: detail.productRef },
                    {
                      ic: "🛡️",
                      label: "ระยะเวลารับประกัน",
                      // Per product category (product_types.warranty_days). Null category default =
                      // no row, so a category without a warranty set never shows "0 วัน".
                      value: detail.warrantyDays ? `${detail.warrantyDays} วัน` : null,
                    },
                    {
                      ic: "⚖️",
                      label: "น้ำหนัก",
                      value:
                        detail.weightGrams > 0
                          ? `${(detail.weightGrams / 1000).toFixed(1)} กก.`
                          : null,
                    },
                  ] as { ic: string; label: string; value: string | null }[]
                )
                  .filter((s) => s.value)
                  .map((s, i) => (
                    <div
                      key={s.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "9px 2px",
                        borderTop: i > 0 ? "1px solid var(--hover)" : "none",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 30,
                          height: 30,
                          flex: "0 0 auto",
                          borderRadius: 9,
                          background: "rgba(1, 90, 191, 0.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 15,
                        }}
                      >
                        {s.ic}
                      </span>
                      <span style={{ flex: 1, fontSize: 13.5, color: "var(--gray-mid)" }}>
                        {s.label}
                      </span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--gray-dark)" }}>
                        {s.value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* รุ่นรถที่ใช้ได้ — collapsible block (Fitment) */}
            {detail.fitments.length > 0 && (
              <>
                <div className="pdp-band" />
                <CollapsibleSection titleTh="รุ่นรถที่ใช้ได้" titleEn="Fitment">
                  {detail.fitments.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 0",
                        borderTop: i > 0 ? "1px solid var(--hover)" : "none",
                      }}
                    >
                      <Icon
                        name="check"
                        size={17}
                        style={{ flexShrink: 0, color: "var(--brand)" }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: "var(--gray-dark)",
                          fontWeight: 500,
                        }}
                      >
                        {fitmentName(f)}
                      </span>
                      <span
                        style={{ fontSize: 13, color: "var(--gray-mid)", whiteSpace: "nowrap" }}
                      >
                        {fitmentYear(f)}
                      </span>
                    </div>
                  ))}
                </CollapsibleSection>
              </>
            )}

            {/* คำอธิบาย — collapsible block (Description) */}
            {detail.description && (
              <>
                <div className="pdp-band" />
                <CollapsibleSection titleTh="คำอธิบาย" titleEn="Description">
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
                </CollapsibleSection>
              </>
            )}

            {/* การคืน ยกเลิก เคลม — collapsible block (Returns & Claims). Always shown: the return/
                claim policy applies to every product; the exact per-category window lives on /returns. */}
            <div className="pdp-band" />
            <CollapsibleSection titleTh="การคืน ยกเลิก เคลม" titleEn="Returns &amp; Claims">
              <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--gray-dark)" }}>
                <p style={{ margin: 0 }}>
                  สินค้าชำรุด เสียหายจากการขนส่ง หรือไม่ตรงตามที่แจ้ง —
                  เปิดเรื่องเคลมได้โดยแนบรูปถ่าย ช่างของเราตรวจสอบและคืนเงินภายใน 2-3
                  วันทำการเมื่ออนุมัติ (ระยะเวลาการคืน/รับประกัน แตกต่างตามหมวดหมู่สินค้า)
                </p>
                <a
                  href="/returns"
                  style={{
                    display: "inline-block",
                    marginTop: 10,
                    color: "var(--brand)",
                    fontWeight: 600,
                  }}
                >
                  อ่านนโยบายการคืน ยกเลิก เคลม แบบเต็ม →
                </a>
              </div>
            </CollapsibleSection>

            <div className="pdp-band" />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div style={{ marginBottom: 16 }}>
            <div className="t-overline" style={{ color: "var(--brand-deep)", marginBottom: 6 }}>
              🔥 สินค้าใกล้เคียง · Related
            </div>
            <h2 className="t-h2" style={{ margin: 0, color: "var(--gray-dark)" }}>
              สินค้าใกล้เคียง
            </h2>
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
          typeName: detail.typeName,
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

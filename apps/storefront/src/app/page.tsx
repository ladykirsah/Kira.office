import Link from "next/link";
import { resolveEffectivePrice } from "@l-shopee/core";
import { Icon } from "@/components/Icon";
import {
  activeBanners,
  bestSellers,
  carBrandTiles,
  getDb,
  listAffiliateItems,
  listCatalog,
  listProductTypes,
  type BannerRow,
  type CatalogItem,
} from "@/lib/db";
import { AffiliateShelf } from "@/components/AffiliateShelf";
import { PART_TYPE_EN, CAR_BRAND_TH, CAR_BRAND_LOGO, OPEN_BOX_TYPE_ID } from "@/lib/labels";
import { BestSellerList } from "@/components/BestSellerList";
import { CategoryRow } from "@/components/CategoryRow";
import { CollectionRow } from "@/components/CollectionRow";
import { Countdown } from "@/components/Countdown";
import { FlashRail } from "@/components/FlashRail";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ProductCard } from "@/components/ProductCard";
import { QuickAccessBar } from "@/components/QuickAccessBar";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { imgUrl } from "@/lib/img";

// Live catalog data from D1 — must render per-request on the Worker, never prerender at build
// time (the build environment has no real database).
export const dynamic = "force-dynamic";

/**
 * Home section order (owner-approved 2026-07-15). The shortcut bar and the orange search header are
 * pinned above and are not part of this sequence:
 *
 *   hero → headline → car brands → part categories → flash sale → best sellers → สินค้าลดราคา →
 *   promo strip → กล่องไม่สวย → trust → product grid → mechanic tools → follow → recently viewed
 *
 * Every data section hides itself when empty, so the order must still read well with sections dark.
 * Four rules hold it together — keep them in mind before moving anything:
 *
 *  1. CAR before PART TYPE. A/C parts are compatibility-gated: the buyer thinks "my Vigo" before
 *     "คอยล์เย็น", and a part that does not fit is a return. The two rails stay adjacent as one
 *     two-door navigation block.
 *  2. No two coral blocks touch. flash is a full coral panel and each CollectionRow leads with a
 *     coral title panel, so สินค้าลดราคา and กล่องไม่สวย are held apart by the white best-seller
 *     list and the promo photo. Reordering these without checking colour re-creates a coral slab.
 *  3. TRUST sits directly above the product grid — the only add-to-cart surface — not at the foot of
 *     the page where it used to be (~4,600px, i.e. never read).
 *  4. The affiliate shelf is the LAST section that renders. Its clicks leave for Shopee/Lazada and
 *     earn commission instead of the shop's own margin, so nothing of the shop's own sits below it.
 *
 * The three discount surfaces are deliberately disjoint, so nothing is advertised twice: flash sale
 * = campaigns of kind 'flash' (countdown), สินค้าลดราคา = kind 'promo' (ongoing), and กล่องไม่สวย =
 * a product category priced low outright, no campaign at all.
 */
export default async function Home() {
  const db = await getDb();
  const now = Date.now();
  const [
    heroBanners,
    types,
    brands,
    flashRaw,
    saleRaw,
    openBox,
    best,
    latest,
    promoBanners,
    tools,
  ] = await Promise.all([
    activeBanners(db, "hero"),
    listProductTypes(db),
    carBrandTiles(db),
    listCatalog(db, { onSaleOnly: true, campaignKind: "flash", limit: 8 }),
    listCatalog(db, { onSaleOnly: true, campaignKind: "promo", limit: 8 }),
    listCatalog(db, { typeId: OPEN_BOX_TYPE_ID, limit: 8 }),
    bestSellers(db, { limit: 5 }),
    listCatalog(db, { limit: 8 }),
    activeBanners(db, "promo"),
    listAffiliateItems(db, 8),
  ]);

  // "กล่องไม่สวย" is a category, but an offer-type one — it gets its own collection below and is kept
  // out of the category strip, which is for part types only (see OPEN_BOX_TYPE_ID).
  const partTypes = types.filter((t) => t.id !== OPEN_BOX_TYPE_ID);

  // The two discount surfaces are queried separately by campaign kind so they never show the same
  // product: `flash` = the urgent countdown rail, `sale` = the ongoing "สินค้าลดราคา" collection.
  // Both lists arrive as campaign CANDIDATES — keep only the ones the core resolver actually
  // discounts (the same rule checkout re-prices with), then count down to the SOONEST-ending flash.
  const onSale = (i: CatalogItem) => resolveEffectivePrice(i.priceSatang, i.campaign, now).onSale;
  const flash = flashRaw.filter(onSale);
  const sale = saleRaw.filter(onSale);
  const flashEnds = flash
    .map((i) => resolveEffectivePrice(i.priceSatang, i.campaign, now).endsAt)
    .filter((e): e is number => e !== null);
  const flashEndsAt = flashEnds.length > 0 ? Math.min(...flashEnds) : null;

  const facebookUrl = process.env.NEXT_PUBLIC_FACEBOOK_URL;

  return (
    <div className="home-sections">
      <section className="section qa-section">
        <QuickAccessBar />
      </section>

      {heroBanners.length > 0 && (
        <section className="section">
          <HeroCarousel banners={heroBanners} />
        </section>
      )}

      <section className="section">
        <h1
          className="t-display-l"
          style={{ margin: "0 0 12px", color: "var(--gray-dark)", textWrap: "balance" }}
        >
          อะไหล่แอร์รถยนต์ <span style={{ color: "var(--brand)" }}>ของแท้</span> ส่งไว
        </h1>
        <p className="t-body-l" style={{ color: "var(--gray-mid)", margin: "0 0 4px" }}>
          ตู้แอร์ คอมเพรสเซอร์ แผงร้อน และอะไหล่ระบบแอร์ โดยช่างตัวจริงจาก Den Air Service
        </p>
      </section>

      {/* Car BEFORE part type: an A/C parts buyer thinks "my Vigo" before "คอยล์เย็น", and a part that
          does not fit is a return. The two rails stay glued together as one two-door navigation block. */}
      {brands.length > 0 && (
        <section className="section">
          <SectionHead
            eyebrow="🚗 ยี่ห้อรถ · Car Fitment"
            title="เลือกตามยี่ห้อรถ"
            link={{ href: "/brands", label: "ดูทั้งหมด →" }}
          />
          <CategoryRow
            items={brands.map((b) => {
              const th = CAR_BRAND_TH[b.brand];
              return {
                href: `/products?carBrand=${encodeURIComponent(b.brand)}&ctx=brand`,
                name: th ?? b.brand, // Thai headline (falls back to the English brand if unmapped)
                nameEn: th ? b.brand : undefined, // English gray sub-line only when we have a Thai headline
                subtitle: `${b.productCount} รายการ`,
                image: CAR_BRAND_LOGO[b.brand], // make logo (Toyota/Honda/Isuzu…), ✦ fallback if unmapped
              };
            })}
          />
        </section>
      )}

      {partTypes.length > 0 && (
        <section className="section">
          <SectionHead
            eyebrow="🗂️ หมวดหมู่ · Categories"
            title="เลือกตามหมวดหมู่"
            link={{ href: "/categories", label: "ดูทั้งหมด →" }}
          />
          <CategoryRow
            items={partTypes.map((t) => ({
              href: `/products?type=${encodeURIComponent(t.id)}&ctx=cat`,
              name: t.name,
              nameEn: PART_TYPE_EN[t.name],
              subtitle: `${t.productCount} รายการ`,
            }))}
          />
        </section>
      )}

      {flash.length > 0 && flashEndsAt !== null && (
        <section
          className="section"
          style={{
            background: "var(--brand)",
            padding: "18px 14px 16px",
            borderRadius: "var(--radius)",
            color: "var(--white)",
          }}
        >
          {/* Design 3 "lightning countdown": centered header, big HH:MM:SS boxes as the hero, then a
              swipe rail of deals with scarcity bars. */}
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div className="t-overline" style={{ color: "rgba(255,255,255,0.9)" }}>
              🔥 แฟลชเซล · Flash Sale
            </div>
            <h3 className="t-h3" style={{ color: "var(--white)", margin: "6px 0 12px" }}>
              ลดวันนี้เท่านั้น
            </h3>
            <Countdown endsAt={flashEndsAt} variant="boxes" />
          </div>
          <FlashRail items={flash} />
        </section>
      )}

      {best.length > 0 && (
        <section className="section">
          <SectionHead eyebrow="🏆 ยอดขายดี · Best Sellers" title="สินค้าขายดี" />
          <BestSellerList items={best} />
        </section>
      )}

      {sale.length > 0 && (
        <section className="section">
          <CollectionRow
            items={sale}
            icon="🏷️"
            title="สินค้าลดราคา"
            subtitle="ดีลราคาพิเศษ"
            seeAllHref="/products?ctx=sale"
          />
        </section>
      )}

      {/* The promo strip leads INTO the open-box shelf it advertises (it used to sit five sections
          below it). Its photo also separates two coral CollectionRows — สินค้าลดราคา above,
          กล่องไม่สวย below — which would otherwise stack into one coral slab. */}
      {promoBanners.length > 0 && (
        <section className="section">
          {promoBanners.map((b) => (
            <PromoStrip key={b.id} banner={b} />
          ))}
        </section>
      )}

      {openBox.length > 0 && (
        <section className="section">
          <CollectionRow
            items={openBox}
            icon="📦"
            title="กล่องไม่สวย"
            subtitle="ของใหม่มือหนึ่ง กล่องมีตำหนิ ราคาถูกกว่า"
            seeAllHref={`/products?type=${encodeURIComponent(OPEN_BOX_TYPE_ID)}&ctx=cat`}
          />
        </section>
      )}

      {/* Trust sits directly ABOVE the product grid, not at the foot of the page. ของแท้ 100% /
          ร้านจริง มีหน้าร้าน / เก็บเงินปลายทาง are this shop's strongest answers to a stranger who
          arrived from a LINE link, so they are read last before the only add-to-cart surface — and
          unlike every data section, this one has no empty guard, so it always anchors the page. */}
      <section className="section">
        {/* .product-grid = 2 cols mobile / 4 cols ≥720px — the exact trust-strip layout */}
        <div className="product-grid">
          <TrustTile icon={truckIcon} title="ส่งไวทั่วไทย" desc="แพ็คส่งภายใน 1-2 วันทำการ" />
          <TrustTile
            icon={payIcon}
            title="จ่ายสะดวก"
            desc="PromptPay · โอนธนาคาร · เก็บเงินปลายทาง"
          />
          <TrustTile icon={shieldIcon} title="ของแท้ 100%" desc="อะไหล่แท้จากผู้ผลิต เช่น Denso" />
          <TrustTile
            icon={storeIcon}
            title="ร้านจริง มีหน้าร้าน"
            desc="โดย Den Air Service จดทะเบียนนิติบุคคล"
          />
        </div>
      </section>

      {latest.length > 0 && (
        <section className="section">
          <SectionHead
            eyebrow="✨ ใหม่ · New Arrivals"
            title="สินค้ามาใหม่"
            link={{ href: "/products", label: "ดูทั้งหมด →" }}
          />
          <div className="product-grid">
            {latest.map((item) => (
              <ProductCard key={item.variantId} item={item} />
            ))}
          </div>
        </section>
      )}

      {tools.length > 0 && (
        <section className="section">
          <SectionHead
            eyebrow="🔧 ช่างแอร์คัดให้ · Mechanic Picks"
            title="เครื่องมือช่างแนะนำ"
            link={{ href: "/tools", label: "ดูทั้งหมด →" }}
          />
          <AffiliateShelf items={tools} />
        </section>
      )}

      {/* LINE lives on the ช่วยหาอะไหล่ shortcut (top of page), so no add-friend button here. */}
      {facebookUrl && (
        <section className="section">
          <div
            className="card"
            style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div className="muted">สอบถาม/แจ้งปัญหา ทักได้เลย</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener"
                className="btn"
                style={{
                  background: "#1877F2",
                  borderColor: "#1877F2",
                  color: "var(--white)",
                  flex: "1 1 200px",
                }}
              >
                ติดตามบน Facebook
              </a>
            </div>
          </div>
        </section>
      )}

      <RecentlyViewed />
    </div>
  );
}

/** Promo strip: like a hero slide but static, wider ratio, one per row (server-safe). */
function PromoStrip({ banner }: { banner: BannerRow }) {
  const image = (
    <div
      className="frame"
      style={{ aspectRatio: "2659 / 984", borderRadius: "var(--radius)", marginBottom: 10 }}
    >
      {banner.imageKey ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl(banner.imageKey)} alt="" loading="lazy" style={{ objectFit: "cover" }} />
      ) : (
        <span aria-hidden="true" style={{ color: "var(--brand)", fontSize: 44, lineHeight: 1 }}>
          ✦
        </span>
      )}
    </div>
  );
  if (banner.linkUrl && banner.linkUrl.startsWith("/")) {
    return (
      <Link href={banner.linkUrl} style={{ display: "block" }}>
        {image}
      </Link>
    );
  }
  if (banner.linkUrl && banner.linkUrl.startsWith("https://")) {
    return (
      <a href={banner.linkUrl} target="_blank" rel="noopener" style={{ display: "block" }}>
        {image}
      </a>
    );
  }
  return image;
}

/**
 * Section head — the locked CI pattern: OVERLINE (small caps brand-deep) above H2, with an
 * optional right-aligned text link. Matches the pattern shown in the component-kit artifact.
 */
function SectionHead({
  eyebrow,
  title,
  link,
}: {
  eyebrow: string;
  title: string;
  link?: { href: string; label: string };
}) {
  // LOCKED headline pattern — one style for every home section head: dark-red overline (--brand-deep)
  // + charcoal title + dark-red "ดูทั้งหมด →". Blue stays reserved for trust highlights, not labels.
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="t-overline" style={{ color: "var(--brand-deep)", marginBottom: 6 }}>
        {eyebrow}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 className="t-h2" style={{ color: "var(--gray-dark)", margin: 0 }}>
          {title}
        </h2>
        {link && (
          <Link
            href={link.href}
            style={{ color: "var(--brand-deep)", fontWeight: 400, fontSize: 13 }}
          >
            {link.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function TrustTile({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div
      className="card"
      style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <span style={{ color: "var(--accent)", display: "inline-flex" }} aria-hidden="true">
        {icon}
      </span>
      <div>
        <div className="t-h4">{title}</div>
        <div className="t-small" style={{ color: "var(--gray-mid)", marginTop: 2 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const truckIcon = <Icon name="truck" size={22} />;

const payIcon = (
  <svg {...iconProps}>
    <rect x="1" y="4" width="22" height="16" rx="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
    <line x1="5" y1="15" x2="9" y2="15" />
  </svg>
);

const shieldIcon = (
  <svg {...iconProps}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 11.5 11 13.5 15 9.5" />
  </svg>
);

const storeIcon = (
  <svg {...iconProps}>
    <path d="M3 9l1.5-5h15L21 9" />
    <path d="M4 9v11h16V9" />
    <path d="M9 20v-6h6v6" />
  </svg>
);

import Link from "next/link";
import { displayNames } from "@l-shopee/core";
import type {
  AffiliateItemRow,
  BannerRow,
  BestSeller,
  CarModelOption,
  CatalogItem,
} from "@/lib/db";
import type { CategoryRow } from "@/lib/groupBySystem";
import { imgUrl } from "@/lib/img";
import { LINE_OA_URL } from "@/lib/links";
import { Icon, type IconName } from "@/components/Icon";
import { HeroCarousel } from "@/components/HeroCarousel";
import { PromoStrip } from "@/components/PromoStrip";
import type { CarBrandOption } from "./CarSheets";
import { FitsForYou } from "./FitsForYou";
import { MyCarCard } from "./MyCarCard";
import { MyCarProvider } from "./MyCarProvider";
import { PhoneBestSellers } from "./PhoneBestSellers";
import { PhoneCard } from "./PhoneCard";
import { PhoneFlash } from "./PhoneFlash";
import { PhoneHeader } from "./PhoneHeader";
import { RecentPhotos } from "./RecentPhotos";

export interface HomePhoneData {
  heroBanners: BannerRow[];
  types: CategoryRow[];
  brands: CarBrandOption[];
  models: CarModelOption[];
  flash: CatalogItem[];
  flashEndsAt: number | null;
  best: BestSeller[];
  latest: CatalogItem[];
  promoBanners: BannerRow[];
  tools: AffiliateItemRow[];
}

const SHORTCUTS: { href: string; icon: IconName; label: string; external?: boolean }[] = [
  { href: "/coupons", icon: "coupon", label: "คูปองส่วนลด" },
  { href: "/orders", icon: "box", label: "ติดตามคำสั่งซื้อ" },
  { href: "/tools", icon: "wrench", label: "เครื่องมือช่าง" },
  { href: LINE_OA_URL, icon: "chat", label: "ช่วยหาอะไหล่", external: true },
];

const TRUST: { icon: IconName; title: string; desc: string }[] = [
  { icon: "truck", title: "ส่งไวทั่วไทย", desc: "แพ็คส่งภายใน 1-2 วันทำการ" },
  { icon: "card", title: "จ่ายสะดวก", desc: "PromptPay · โอนธนาคาร · เก็บเงินปลายทาง" },
  { icon: "shield", title: "ของแท้ 100%", desc: "อะไหล่แท้จากผู้ผลิต เช่น Denso" },
  { icon: "store", title: "ร้านจริง มีหน้าร้าน", desc: "โดย Den Air Service จดทะเบียนนิติบุคคล" },
];

const FOOTER_LINKS: [string, string][] = [
  ["/products", "สินค้า"],
  ["/orders", "ติดตามคำสั่งซื้อ"],
  ["/info", "การจัดส่งและการชำระเงิน"],
  ["/returns", "การคืน ยกเลิก เคลม"],
  ["/faq", "คำถามที่พบบ่อย"],
  ["/privacy", "นโยบายความเป็นส่วนตัว"],
  ["/terms", "ข้อกำหนด"],
];

const PARTNER: Record<string, { label: string; cls: string }> = {
  shopee: { label: "Shopee", cls: "hm-partner--shopee" },
  lazada: { label: "Lazada", cls: "hm-partner--lazada" },
};

function SectionHead({ title, more }: { title: string; more?: string }) {
  return (
    <div className="hm-sec-head">
      <h2 className="hm-sec-t">{title}</h2>
      {more && (
        <Link className="hm-more" href={more}>
          ดูทั้งหมด
        </Link>
      )}
    </div>
  );
}

/** A picture that fills its frame, or the ✦ mark when the owner has not uploaded one. */
function Pic({ src, className }: { src: string | null; className: string }) {
  return (
    <span className={className}>
      {src ? <img src={src} alt="" loading="lazy" /> : <span aria-hidden="true">✦</span>}
    </span>
  );
}

function Shortcuts() {
  return (
    <nav className="hm-sec hm-shortcuts" aria-label="ทางลัด">
      {SHORTCUTS.map((s) => {
        const inner = (
          <>
            <span className="hm-sc-ic">
              <Icon name={s.icon} size={22} />
            </span>
            {s.label}
          </>
        );
        return s.external ? (
          <a key={s.label} className="hm-sc" href={s.href} target="_blank" rel="noopener">
            {inner}
          </a>
        ) : (
          <Link key={s.label} className="hm-sc" href={s.href}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}

function Categories({ types }: { types: CategoryRow[] }) {
  if (types.length === 0) return null;
  return (
    <section className="hm-sec" aria-label="หมวดหมู่">
      <SectionHead title="หมวดหมู่" more="/categories" />
      <div className="hm-grid4">
        {types.slice(0, 4).map((t) => (
          <Link
            key={t.id}
            className="hm-sc"
            href={`/products?type=${encodeURIComponent(t.id)}&ctx=cat`}
          >
            <Pic className="hm-cat-pic" src={t.imageKey ? imgUrl(t.imageKey) : null} />
            <span className="hm-one-line">{displayNames(t).th}</span>
            <span className="hm-muted-xs">{t.productCount} รายการ</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Brands({ brands }: { brands: CarBrandOption[] }) {
  if (brands.length === 0) return null;
  return (
    <section className="hm-sec" aria-label="ยี่ห้อรถ">
      <SectionHead title="ยี่ห้อรถ" more="/brands" />
      <div className="hm-grid4">
        {brands.slice(0, 4).map((b) => (
          <Link
            key={b.brand}
            className="hm-sc"
            href={`/products?carBrand=${encodeURIComponent(b.brand)}&ctx=brand`}
          >
            <Pic className="hm-brand-pic" src={b.logo} />
            {b.brand}
            <span className="hm-muted-xs">{b.productCount} รายการ</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Tools({ tools }: { tools: AffiliateItemRow[] }) {
  if (tools.length === 0) return null;
  return (
    <section className="hm-sec" aria-label="ช่างแอร์คัดให้">
      <SectionHead title="ช่างแอร์คัดให้" more="/tools" />
      <div className="hm-grid3">
        {tools.slice(0, 3).map((t) => {
          const p = PARTNER[t.source];
          return (
            <a
              key={t.id}
              className="hm-tool"
              href={`/go/${t.id}`}
              target="_blank"
              rel="sponsored noopener"
            >
              <Pic className="hm-pic1" src={t.imageKey ? imgUrl(t.imageKey) : null} />
              <span className="hm-name2 hm-name2--13">{t.title}</span>
              {t.priceText && <span className="hm-tool-price">{t.priceText}</span>}
              <span className={`hm-partner ${p ? p.cls : ""}`}>{p ? p.label : "ร้านค้า"} ↗</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="hm-sec hm-trust" aria-label="ทำไมต้อง AirPlus">
      {TRUST.map((t) => (
        <div key={t.title} className="hm-trust-item">
          <span className="hm-red">
            <Icon name={t.icon} size={22} />
          </span>
          <span className="hm-trust-text">
            <b>{t.title}</b>
            <span className="hm-muted-sm">{t.desc}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

function Help() {
  return (
    <section className="hm-sec" aria-label="ช่วยเลือก">
      <h2 className="hm-sec-t">ไม่แน่ใจว่าต้องใช้ตัวไหน?</h2>
      <div className="hm-help-btns">
        <a className="hm-outl" href={LINE_OA_URL} target="_blank" rel="noopener">
          <Icon name="line" size={18} />
          ถามช่างทาง LINE
        </a>
        <Link className="hm-outl hm-outl--grey" href="/faq">
          คำถามที่พบบ่อย
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="hm-foot">
      <nav className="hm-foot-links" aria-label="ลิงก์ร้าน">
        {FOOTER_LINKS.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <p className="hm-muted-sm">
        อะไหล่แอร์รถยนต์ ของแท้ ส่งไว — ดำเนินการโดย Den Air Service (จดทะเบียนนิติบุคคลในประเทศไทย)
      </p>
    </footer>
  );
}

/**
 * The phone home page = board 1 (owner-approved 5 Nov 2026), shown under 720px only; computers keep
 * today's home (owner: "Keep today's computer page"). Order follows the drawing: header → รถของฉัน →
 * shortcuts → banner → flash → fits your car → categories → car brands → ขายดี → มาใหม่ → promo →
 * mechanic picks → trust → help → recently viewed → footer. Every data section hides when empty.
 */
export function HomePhone(d: HomePhoneData) {
  return (
    <MyCarProvider>
      <div className="home-phone">
        <PhoneHeader />
        <MyCarCard brands={d.brands} models={d.models} lift />
        <Shortcuts />
        {d.heroBanners.length > 0 && (
          <div className="hm-hero">
            <HeroCarousel banners={d.heroBanners} />
          </div>
        )}
        {d.flash.length > 0 && d.flashEndsAt !== null && (
          <PhoneFlash items={d.flash} endsAt={d.flashEndsAt} />
        )}
        <FitsForYou />
        <Categories types={d.types} />
        <Brands brands={d.brands} />
        {d.best.length > 0 && <PhoneBestSellers items={d.best} />}
        {d.latest.length > 0 && (
          <div className="hm-plain">
            <SectionHead title="มาใหม่" more="/products" />
            <div className="hm-grid2 hm-grid2--8">
              {d.latest.slice(0, 2).map((item) => (
                <PhoneCard key={item.variantId} item={item} />
              ))}
            </div>
          </div>
        )}
        {d.promoBanners.map((b) => (
          <div key={b.id} className="hm-promo">
            <PromoStrip banner={b} phone />
          </div>
        ))}
        <Tools tools={d.tools} />
        <Trust />
        <Help />
        <RecentPhotos />
        <Footer />
      </div>
    </MyCarProvider>
  );
}

import { imgUrl } from "./img";

/**
 * Canonical PRODUCTION origin. Canonical / OpenGraph / JSON-LD URLs always point here — never at a
 * staging host — so the prod page is the one search engines index. Overridable per-env if ever needed.
 */
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://airplusauto.com";

/** The subset of a product the SEO builders need — kept minimal so they stay pure + easy to test. */
export interface SeoProduct {
  productId: string;
  name: string;
  brandName: string | null;
  typeName: string | null;
  productRef: string;
  description: string | null;
  imageKey: string | null;
  onHand: number;
  warrantyDays: number | null;
  fitments: {
    carBrand: string | null;
    carModel: string | null;
    yearFrom: number | null;
    yearTo: number | null;
  }[];
}

/** First fitment as "Toyota Vios" (brand + model), or "" when none is recorded. */
function primaryFitment(p: SeoProduct): string {
  const f = p.fitments[0];
  if (!f) return "";
  return [f.carBrand, f.carModel]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Keyword-rich <title>: the product name, then brand · fitment · แท้ (genuine) appended ONLY when they
 * are not already in the name. Unlike the competitor's 369-char stuffing, this stays focused — Google
 * reads the whole title but each term appears once. Always suffixed " | AirPlus".
 */
export function productSeoTitle(p: SeoProduct): string {
  let acc = p.name.trim();
  const add = (s: string | null | undefined) => {
    const v = (s ?? "").trim();
    if (v && !acc.includes(v)) acc += ` ${v}`;
  };
  add(p.brandName);
  add(primaryFitment(p));
  add("แท้");
  return `${acc} | AirPlus`;
}

/** Meta description: a keyword sentence from the structured fields, degrading cleanly past any nulls. */
export function productMetaDescription(p: SeoProduct): string {
  let s = p.name.trim();
  if (!s.includes("แท้")) s += " ของแท้";
  const brand = (p.brandName ?? "").trim();
  if (brand && !s.includes(brand)) s += ` ยี่ห้อ ${brand}`;
  const fit = primaryFitment(p);
  if (fit && !s.includes(fit)) s += ` สำหรับ ${fit}`;
  if (p.warrantyDays && p.warrantyDays > 0) s += ` รับประกัน ${p.warrantyDays} วัน`;
  s += " · ส่งไว จ่ายปลายทางได้ — AirPlus by Den Air Service";
  return s.length > 200 ? `${s.slice(0, 197).trimEnd()}…` : s;
}

/**
 * schema.org Product + Offer (+ Brand/category/image when present). `priceSatang` is the EFFECTIVE
 * price the page shows (post-campaign), so the structured price matches the visible one. Optional
 * fields are omitted rather than set to null — a `null` in JSON-LD is worse than an absent key.
 */
export function productJsonLd(
  p: SeoProduct,
  opts: { priceSatang: number },
): Record<string, unknown> {
  const url = `${SITE_ORIGIN}/products/${p.productId}`;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.productRef,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "THB",
      price: (opts.priceSatang / 100).toFixed(2),
      availability: p.onHand > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
  const desc = (p.description ?? "").trim() || productMetaDescription(p);
  if (desc) ld.description = desc;
  if (p.brandName?.trim()) ld.brand = { "@type": "Brand", name: p.brandName.trim() };
  if (p.typeName?.trim()) ld.category = p.typeName.trim();
  if (p.imageKey) ld.image = [imgUrl(p.imageKey)];
  return ld;
}

/**
 * Serialize a JSON-LD object for injection into a `<script>` tag. Escapes `<` to its unicode escape
 * so a value containing `</script>` (e.g. a hostile product name) can't close the tag and inject
 * markup — the string stays valid JSON and round-trips through JSON.parse. Defense-in-depth: product
 * data is admin-entered, but structured data goes to raw HTML, so it must never be trusted verbatim.
 */
export function serializeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/** schema.org BreadcrumbList: หน้าแรก → สินค้า → this product, with absolute prod URLs. */
export function breadcrumbJsonLd(p: SeoProduct): Record<string, unknown> {
  const crumb = (position: number, name: string, path: string) => ({
    "@type": "ListItem",
    position,
    name,
    item: `${SITE_ORIGIN}${path}`,
  });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      crumb(1, "หน้าแรก", "/"),
      crumb(2, "สินค้า", "/products"),
      crumb(3, p.name, `/products/${p.productId}`),
    ],
  };
}

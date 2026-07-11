import Link from "next/link";
import type { Metadata } from "next";
import {
  carBrandsForType,
  fitmentOptions,
  getDb,
  listBrands,
  listCatalog,
  listProductTypes,
  productTypesForCarBrand,
} from "@/lib/db";
import { ProductCard } from "@/components/ProductCard";
import { ProductFilter } from "@/components/ProductFilter";

// Live catalog data from D1 — must render per-request on the Worker, never prerender at build
// time (the build environment has no real database).
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "สินค้า — AirPlus" };

/**
 * Catalog page with three browse contexts, chosen by the `ctx` marker the entry link carries (so the
 * SAME url — e.g. type + carBrand both set — remembers how the shopper got here):
 *  • ctx=cat  → 🗂️ Categories: a specific part category; shortcut chips narrow by CAR BRAND.
 *  • ctx=brand→ 🚗 Car Fitment: a specific car brand; shortcut chips narrow by PART CATEGORY.
 *  • (none)   → 🛒 Products: all products / search results; shortcut chips pick a category.
 * The shortcut always offers the CROSS axis, scoped so it never lists a dead-end (0-result) chip.
 */
export default async function ProductsPage(props: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    brand?: string;
    carBrand?: string;
    carModel?: string;
    year?: string;
    ctx?: string;
  }>;
}) {
  const { q, type, brand, carBrand, carModel, year, ctx } = await props.searchParams;
  const db = await getDb();
  const isCategoryView = ctx === "cat" && Boolean(type);
  const isBrandView = ctx === "brand" && Boolean(carBrand);
  const isSaleView = ctx === "sale"; // on-sale deals; the ctx marker also drives the onSaleOnly filter
  const [types, brands, fitments, items, catCarBrands, brandTypes] = await Promise.all([
    listProductTypes(db),
    listBrands(db),
    fitmentOptions(db),
    listCatalog(db, {
      q,
      typeId: type,
      brandId: brand,
      carBrand,
      carModel,
      year: year ? Number(year) : undefined,
      onSaleOnly: isSaleView,
      limit: 48,
    }),
    isCategoryView && type ? carBrandsForType(db, type) : Promise.resolve<string[]>([]),
    isBrandView && carBrand
      ? productTypesForCarBrand(db, carBrand)
      : Promise.resolve<{ id: string; name: string }[]>([]),
  ]);

  // One href builder: start from the current params, apply overrides (undefined = drop that key).
  const hrefWith = (over: Partial<Record<string, string | undefined>>) => {
    const base: Record<string, string | undefined> = {
      q,
      type,
      brand,
      carBrand,
      carModel,
      year,
      ctx,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...over })) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/products?${qs}` : "/products";
  };

  // Products context: pick a part category (entering Categories context). "ทั้งหมด" clears it.
  const catChipHref = (typeId?: string) =>
    typeId ? hrefWith({ type: typeId, ctx: "cat" }) : hrefWith({ type: undefined, ctx: undefined });
  // Categories context: narrow the category by car brand. Switching brand drops the model.
  const catCarChipHref = (cb?: string) => hrefWith({ carBrand: cb, carModel: undefined });
  // By Brand context: narrow the brand by part category.
  const brandTypeChipHref = (typeId?: string) => hrefWith({ type: typeId });

  // Headline names where the shopper is: a car brand (By Brand), a category, a search, or all.
  const typeName = type ? types.find((t) => t.id === type)?.name : undefined;
  const headline = isSaleView
    ? "สินค้าลดราคาทั้งหมด"
    : isBrandView
      ? `${carBrand} ทั้งหมด`
      : q
        ? `${typeName ?? "สินค้าทั้งหมด"}สำหรับ ${q}`
        : typeName
          ? `${typeName}ทั้งหมด`
          : "สินค้าทั้งหมด";
  const overline = isSaleView
    ? "🏷️ สินค้าลดราคา · On Sales Products"
    : isBrandView
      ? "🚗 ยี่ห้อรถ · Car Fitment"
      : isCategoryView
        ? "🗂️ หมวดหมู่ · Categories"
        : "🛒 สินค้า · Products";

  return (
    <div className="section" style={{ marginTop: 4 }}>
      <div style={{ marginBottom: 20 }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)", marginBottom: 6 }}>
          {overline}
        </div>
        <h1 className="t-h1" style={{ color: "var(--gray-dark)", margin: 0 }}>
          {headline}
        </h1>
      </div>

      {isSaleView ? null : isBrandView ? ( // On-Sale is a flat deals list — no cross-axis shortcut
        // By Brand: narrow this car brand by part category (only categories it actually has).
        brandTypes.length > 0 && (
          <div className="chip-row" style={{ marginBottom: 12 }}>
            <Link href={brandTypeChipHref()} className={type ? "chip" : "chip on"}>
              ทั้งหมด
            </Link>
            {brandTypes.map((t) => (
              <Link
                key={t.id}
                href={brandTypeChipHref(t.id)}
                className={t.id === type ? "chip on" : "chip"}
              >
                {t.name}
              </Link>
            ))}
          </div>
        )
      ) : isCategoryView ? (
        // Categories: narrow this category by car brand (only brands present in it).
        catCarBrands.length > 0 && (
          <div className="chip-row" style={{ marginBottom: 12 }}>
            <Link href={catCarChipHref()} className={carBrand ? "chip" : "chip on"}>
              ทั้งหมด
            </Link>
            {catCarBrands.map((cb) => (
              <Link
                key={cb}
                href={catCarChipHref(cb)}
                className={cb === carBrand ? "chip on" : "chip"}
              >
                {cb}
              </Link>
            ))}
          </div>
        )
      ) : (
        // Products / search: pick a part category.
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <Link href={catChipHref()} className={type ? "chip" : "chip on"}>
            ทั้งหมด
          </Link>
          {types.map((t) => (
            <Link
              key={t.id}
              href={catChipHref(t.id)}
              className={t.id === type ? "chip on" : "chip"}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <ProductFilter
          fitments={fitments}
          types={types}
          brands={brands}
          current={{ q, carBrand, carModel, year, type, brand, ctx }}
        />
      </div>

      <p className="muted" style={{ margin: "0 0 12px" }}>
        {q
          ? `ผลการค้นหา “${q}” — พบ ${items.length} รายการ`
          : isSaleView || isBrandView || typeName
            ? `ผลการค้นหา “${headline}” — พบ ${items.length} รายการ`
            : `พบ ${items.length} รายการ`}
      </p>

      {items.length > 0 ? (
        <div className="product-grid">
          {items.map((item) => (
            <ProductCard key={item.variantId} item={item} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <div className="t-h4" style={{ marginBottom: 6 }}>
            ไม่พบสินค้า
          </div>
          <p className="muted" style={{ margin: "0 0 16px" }}>
            ลองค้นหาด้วยรุ่นรถ เช่น Vigo, D-Max หรือเลขอะไหล่
          </p>
          <Link href="/products" className="btn">
            ดูสินค้าทั้งหมด
          </Link>
        </div>
      )}
    </div>
  );
}

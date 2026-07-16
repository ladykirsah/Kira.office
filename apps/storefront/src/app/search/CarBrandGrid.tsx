import Link from "next/link";
import { CAR_BRAND_LOGO, CAR_BRAND_TH } from "@/lib/labels";

/**
 * "ค้นหาตามรถของคุณ" — a grid of car-brand tiles whose logo fills the whole square (same logo assets
 * as the home by-brand row; ✦ fallback for brands without a logo file). No "ทั้งหมด" tile — every
 * tile is a real make. Pure display → server component. Each tile filters /products by fitment.
 */
export function CarBrandGrid({ brands }: { brands: { brand: string; productCount: number }[] }) {
  if (brands.length === 0) return null;
  return (
    <section>
      <h2 className="search-head">
        🚗 ค้นหาตามรถของคุณ <small>· By your car</small>
      </h2>
      <div className="car-grid">
        {brands.map((b) => {
          const th = CAR_BRAND_TH[b.brand];
          const logo = CAR_BRAND_LOGO[b.brand];
          return (
            <Link
              key={b.brand}
              href={`/products?carBrand=${encodeURIComponent(b.brand)}&ctx=brand`}
              className="car-tile"
            >
              <div className="car-thumb">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={b.brand} loading="lazy" />
                ) : (
                  <span aria-hidden="true" className="star">
                    ✦
                  </span>
                )}
              </div>
              <div className="car-name">{th ?? b.brand}</div>
              {th && <div className="car-en">{b.brand}</div>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

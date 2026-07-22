import Link from "next/link";
import { displayNames } from "@l-shopee/core";
import { resolveBrandLogo } from "@/lib/brandLogo";

/**
 * "ค้นหาตามรถของคุณ" — a grid of car-brand tiles whose logo fills the whole square (owner-uploaded
 * cover first, bundled logo as fallback, ✦ when neither exists). No "ทั้งหมด" tile — every tile is
 * a real make. Pure display → server component. Each tile filters /products by fitment.
 */
export function CarBrandGrid({
  brands,
}: {
  // imageKey MUST stay on this type: dropping it is what silently ignored owner-uploaded logos here
  // while /brands and the home row showed them. nameTh/nameEn are here for the same reason — a
  // narrower prop type is how this tile fell out of step with the others once already.
  brands: {
    brand: string;
    nameTh: string | null;
    nameEn: string | null;
    productCount: number;
    imageKey: string | null;
  }[];
}) {
  if (brands.length === 0) return null;
  return (
    <section>
      <h2 className="search-head">
        🚗 ค้นหาตามรถของคุณ <small>· By your car</small>
      </h2>
      <div className="car-grid">
        {brands.map((b) => {
          const th = displayNames({ name: b.brand, nameTh: b.nameTh, nameEn: b.nameEn }).th;
          const logo = resolveBrandLogo(b.brand, b.imageKey);
          return (
            <Link
              key={b.brand}
              href={`/products?carBrand=${encodeURIComponent(b.brand)}&ctx=brand`}
              className="car-tile"
            >
              <div className="car-thumb">
                {logo ? (
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

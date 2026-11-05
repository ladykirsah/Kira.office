import Link from "next/link";
import { displayNames } from "@l-shopee/core";
import type { SystemGroup } from "@/lib/groupBySystem";
import { imgUrl } from "@/lib/img";
import { Icon } from "@/components/Icon";
import { BrandLogo, type CarBrandOption } from "@/components/home/CarSheets";

/**
 * Board 2 · 2.7–2.8 on the phone (owner-approved 5 Nov 2026): the หมวดหมู่ tab — big title, a
 * หมวดหมู่ | ยี่ห้อรถ switch (kept in the url, ?tab=cars), then every category under its system (real
 * picture, Thai + English, count) or every car brand. A row opens that category's / brand's products.
 */
export function CategoriesPhone({
  tab,
  groups,
  cars,
}: {
  tab: "cats" | "cars";
  groups: SystemGroup[];
  cars: CarBrandOption[];
}) {
  return (
    <div className="b2-phone">
      <h1 className="b2-big">หมวดหมู่</h1>
      <nav className="b2-seg" aria-label="ดูตาม">
        <Link href="/categories" replace aria-current={tab === "cats" ? "page" : undefined}>
          หมวดหมู่
        </Link>
        <Link
          href="/categories?tab=cars"
          replace
          aria-current={tab === "cars" ? "page" : undefined}
        >
          ยี่ห้อรถ
        </Link>
      </nav>

      {tab === "cars" ? (
        <div className="b2-flat">
          {cars.map((b) => (
            <Link
              key={b.brand}
              href={`/products?carBrand=${encodeURIComponent(b.brand)}&ctx=brand`}
              className="b2-li"
            >
              <BrandLogo src={b.logo} size={44} />
              <span className="b2-li-in">
                <span className="b2-li-name">
                  {b.brand}
                  <small>{b.nameTh?.trim() || b.brand}</small>
                </span>
                <span className="b2-li-cnt">{b.productCount} รายการ</span>
                <Icon name="chevron" size={15} />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        groups.map((g, i) => {
          const sys = g.system ? displayNames(g.system) : null;
          return (
            <section key={g.system?.id ?? `other-${i}`}>
              <h2 className="b2-sys">{sys ? sys.th : "อื่นๆ"}</h2>
              <div className="b2-flat">
                {g.categories.map((t) => {
                  const names = displayNames(t);
                  return (
                    <Link
                      key={t.id}
                      href={`/products?type=${encodeURIComponent(t.id)}&ctx=cat`}
                      className="b2-li"
                    >
                      {t.imageKey ? (
                        <img className="b2-thumb" src={imgUrl(t.imageKey)} alt="" loading="lazy" />
                      ) : (
                        <span className="b2-thumb b2-photo-none" aria-hidden="true">
                          ✦
                        </span>
                      )}
                      <span className="b2-li-in">
                        <span className="b2-li-name">
                          {names.th}
                          {names.en && <small>{names.en}</small>}
                        </span>
                        <span className="b2-li-cnt">{t.productCount} รายการ</span>
                        <Icon name="chevron" size={15} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

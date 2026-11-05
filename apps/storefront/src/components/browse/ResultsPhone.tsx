"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CarModelOption, CatalogItem } from "@/lib/db";
import type { CategoryRow } from "@/lib/groupBySystem";
import {
  activeFilterCount,
  browseHref,
  carOnFrom,
  filterApply,
  filterByCar,
  type BrowseMode,
  parseSort,
  resultLine,
  sortTabs,
} from "@/lib/browse";
import { LINE_OA_URL } from "@/lib/links";
import { carName, type MyCar } from "@/lib/myCar";
import { Icon } from "@/components/Icon";
import { BrandLogo, CarPicker, MyCarSheet, type CarBrandOption } from "@/components/home/CarSheets";
import { useMyCar } from "@/components/home/MyCarProvider";
import { PhoneCard } from "@/components/home/PhoneCard";
import { SubHeader } from "@/components/home/SubHeader";
import { FilterSheet, type FilterChoice } from "./FilterSheet";
import { SearchResultBar } from "./SearchBar";

export type BrowseParams = Partial<
  Record<"q" | "type" | "brand" | "carBrand" | "carModel" | "year" | "ctx" | "sort" | "car", string>
>;

export type { BrowseMode };

const carFull = (car: MyCar) => `${carName(car)}${car.year === null ? "" : ` ${car.year}`}`;

function Grid({ items }: { items: CatalogItem[] }) {
  return (
    <div className="hm-grid2 hm-grid2--8 hm-pad">
      {items.map((item) => (
        <PhoneCard key={item.variantId} item={item} />
      ))}
    </div>
  );
}

/** 2.6 ไม่พบสินค้า */
function Empty() {
  return (
    <div className="b2-empty">
      <span className="b2-empty-ic">
        <Icon name="search" size={32} />
      </span>
      <p className="b2-empty-t">ไม่พบสินค้า</p>
      <p className="b2-empty-s">ลองค้นด้วยรุ่นรถ เช่น Vigo, D-Max หรือรหัสอะไหล่</p>
      <Link href="/products" className="b2-btn-red">
        ดูสินค้าทั้งหมด
      </Link>
      <a
        href={`${LINE_OA_URL}?openExternalBrowser=1`}
        target="_blank"
        rel="noopener noreferrer"
        className="b2-btn-line"
      >
        <Icon name="line" size={18} />
        ถามช่างทาง LINE
      </a>
    </div>
  );
}

/**
 * Board 2 results on the phone (owner-approved 5 Nov 2026): 2.2 search with the sort bar, 2.3 after ×,
 * 2.4–2.5 ตัวกรอง, 2.6 nothing found, 2.9–2.10 one category. A saved car filters the list (only parts
 * that fit) until the shopper taps the plain × on its card; ตัวกรอง → รถของคุณ turns it back on.
 */
export function ResultsPhone({
  mode,
  title,
  params,
  items,
  types,
  brands,
  carChips,
  typeChips,
  carBrands,
  carModels,
}: {
  mode: BrowseMode;
  /** the grey bar's title (category / car brand / deals); the search bar shows the term instead */
  title: string;
  params: BrowseParams;
  items: CatalogItem[];
  /** every category, most stocked first */
  types: CategoryRow[];
  brands: { id: string; name: string }[];
  /** cat: the car brands this category has (chips while my car isn't filtering) */
  carChips: string[];
  /** brand: the categories this car brand has */
  typeChips: { id: string; name: string }[];
  carBrands: CarBrandOption[];
  carModels: CarModelOption[];
}) {
  const router = useRouter();
  const { car, ready, fit, fitFailed } = useMyCar();
  const [open, setOpen] = useState<"filter" | "mine" | "pick" | null>(null);

  const nothing = items.length === 0;
  const carOn = carOnFrom(params.car);
  // a car-brand page is already one car's parts — my car would be a second car filter there
  const carActive = Boolean(car) && carOn && mode !== "brand";
  // until the saved car is read from the phone we can't tell which list to show — wait rather than flash the other
  const waiting = !ready && mode !== "brand";
  const logo = car ? (carBrands.find((b) => b.brand === car.brand)?.logo ?? null) : null;
  const href = (over: BrowseParams) => browseHref(params, over);
  const go = (over: BrowseParams) => router.replace(href(over), { scroll: false });
  const badge = activeFilterCount({
    carOn: carActive,
    // on a category page the category IS the page, not a filter
    type: mode === "cat" ? undefined : params.type,
    brand: params.brand,
  });

  function apply(next: FilterChoice) {
    setOpen(null);
    go(filterApply(mode, params, next));
  }

  const filterBtn = (cls: string) => (
    <button type="button" className={cls} onClick={() => setOpen("filter")}>
      <Icon name="filter" size={16} />
      ตัวกรอง
      {badge > 0 && <span className="b2-badge">{badge}</span>}
    </button>
  );

  // ── the list: my car's parts, or everything ───────────────────────────────────────────
  let list: React.ReactNode;
  if (nothing) {
    list = <Empty />;
  } else if (waiting) {
    list = <p className="b2-count">กำลังโหลด…</p>;
  } else if (carActive && car && fitFailed) {
    list = (
      <>
        <p className="b2-count">โหลดรถของคุณไม่สำเร็จ · พบ {items.length} รายการ</p>
        <Grid items={items} />
      </>
    );
  } else if (carActive && car && !fit) {
    list = <p className="b2-count">กำลังโหลด…</p>;
  } else if (carActive && car && fit) {
    const shown = filterByCar(items, fit.ids, true);
    list = (
      <>
        <p className="b2-count">
          {resultLine({ shown: shown.length, total: items.length, carFiltered: true })}
        </p>
        {shown.length === 0 ? (
          // nothing fits: say so; the × on the card above shows everything
          <p className="hm-empty">ยังไม่มีชิ้นที่ใส่กับ {carFull(car)} ได้</p>
        ) : (
          <Grid items={shown} />
        )}
      </>
    );
  } else {
    // after × (2.3 / 2.10): every result; my car comes back through ตัวกรอง → รถของคุณ (2.4)
    list = (
      <>
        <p className="b2-count">
          {resultLine({ shown: items.length, total: items.length, carFiltered: false })}
        </p>
        <Grid items={items} />
      </>
    );
  }

  return (
    <div className="b2-phone">
      {mode === "search" ? <SearchResultBar q={params.q ?? ""} /> : <SubHeader title={title} />}

      {mode === "search" && (
        <nav className="b2-sort" aria-label="เรียงลำดับ">
          {sortTabs(parseSort(params.sort)).map((t) => (
            <Link
              key={t.label}
              href={href({ sort: t.sort === "relevant" ? undefined : t.sort })}
              replace
              scroll={false}
              className={t.on ? "b2-sort-tab b2-sort-tab--on" : "b2-sort-tab"}
              aria-current={t.on ? "true" : undefined}
            >
              {t.label}
              {t.label === "ราคา" && <Icon name="sort" size={14} />}
            </Link>
          ))}
          <span className="b2-sort-line" />
          {filterBtn("b2-filter-btn")}
        </nav>
      )}

      {/* 2.6 nothing found: just the bars and the empty card (no chips, no car card) */}
      {!nothing && !waiting && (
        <div className="b2-chip-row">
          {mode !== "search" && filterBtn("b2-chip")}
          {mode === "search" &&
            [
              { id: "", name: "ทั้งหมด" },
              ...types.map((t) => ({ id: t.id, name: t.nameTh ?? t.name })),
            ].map((t) => (
              <Link
                key={t.id || "all"}
                href={href({ type: t.id || undefined })}
                replace
                scroll={false}
                className={(params.type ?? "") === t.id ? "b2-chip b2-chip--on" : "b2-chip"}
              >
                {t.name}
              </Link>
            ))}
          {/* while my car filters, the car-brand chips step aside (two car filters would fight) */}
          {mode === "cat" &&
            !carActive &&
            carChips.length > 0 &&
            ["", ...carChips].map((cb) => (
              <Link
                key={cb || "all"}
                href={href({ carBrand: cb || undefined, carModel: undefined })}
                replace
                scroll={false}
                className={(params.carBrand ?? "") === cb ? "b2-chip b2-chip--on" : "b2-chip"}
              >
                {cb || "ทั้งหมด"}
              </Link>
            ))}
          {mode === "brand" &&
            typeChips.length > 0 &&
            [{ id: "", name: "ทั้งหมด" }, ...typeChips].map((t) => (
              <Link
                key={t.id || "all"}
                href={href({ type: t.id || undefined })}
                replace
                scroll={false}
                className={(params.type ?? "") === t.id ? "b2-chip b2-chip--on" : "b2-chip"}
              >
                {t.name}
              </Link>
            ))}
        </div>
      )}

      {!nothing && carActive && car && (
        <div className="b2-car">
          <button type="button" className="b2-car-main" onClick={() => setOpen("mine")}>
            <BrandLogo src={logo} size={32} />
            <span className="b2-car-text">
              <span className="hm-muted-sm">รถของฉัน</span>
              <b>{carFull(car)}</b>
            </span>
          </button>
          <button
            type="button"
            className="b2-car-x"
            aria-label="เอาตัวกรองรถออก"
            onClick={() => go({ car: "off" })}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      {list}

      {open === "filter" && (
        <FilterSheet
          initial={{ carOn: carActive, type: params.type, brand: params.brand }}
          types={types}
          brands={brands}
          carBrands={carBrands}
          carModels={carModels}
          onApply={apply}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "mine" && car && (
        <MyCarSheet
          car={car}
          logo={logo}
          onClose={() => setOpen(null)}
          onPickOther={() => setOpen("pick")}
        />
      )}
      {open === "pick" && (
        <CarPicker brands={carBrands} models={carModels} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

"use client";

import type { CarModelOption, CatalogItem } from "@/lib/db";
import type { CartLine } from "@/lib/cart";
import { baht } from "@/lib/format";
import { salePercent, specRows, type Fitment } from "@/lib/productPage";
import type { PickChoice } from "@/lib/sizePicker";
import { Countdown } from "@/components/Countdown";
import { ChoicesRow } from "@/components/ProductSizes";
import type { CarBrandOption } from "@/components/home/CarSheets";
import { PhoneCard } from "@/components/home/PhoneCard";
import { CarFit } from "./CarFit";
import { InfoCard } from "./InfoCard";
import { PhoneBuyBar } from "./PhoneBuyBar";
import { PhoneGallery } from "./PhoneGallery";

export interface ProductPhoneProps {
  line: Omit<CartLine, "qty">;
  imageKeys: string[];
  onHand: number;
  categoryName: string | null;
  /** EFFECTIVE price (flash sale resolved by the server, as checkout does) */
  priceSatang: number;
  compareAtSatang: number | null;
  /** the flash sale's end while one runs (red strip + countdown) */
  saleEndsAt: number | null;
  /** "฿30 – ฿40" for a product with sizes; null otherwise */
  rangeText: string | null;
  choices: PickChoice[];
  fitments: Fitment[];
  warrantyDays: number | null;
  warrantyText: string | null;
  terms: string | null;
  description: string | null;
  weightGrams: number;
  related: CatalogItem[];
  carBrands: CarBrandOption[];
  carModels: CarModelOption[];
}

/**
 * AirPlus board 3 on the phone (owner-approved 14 Nov 2026): photos · price · name · category, brand,
 * พร้อมส่ง · ตัวเลือก (sizes) · the car card + ใส่ได้กับรถ (every model, open) · รายละเอียดสินค้า · ONE card
 * of การจัดส่ง · รับประกัน · เงื่อนไข · คืน·เคลม · คำอธิบาย · สินค้าใกล้เคียง · bottom bar. No product code
 * on AirPlus (owner, 5 Nov). Computers keep today's page.
 */
export function ProductPhone(p: ProductPhoneProps) {
  const pct = salePercent(p.priceSatang, p.compareAtSatang);
  const onSale = p.rangeText === null && p.saleEndsAt !== null && pct !== null;
  const specs = specRows({
    categoryName: p.categoryName,
    brandName: p.line.brandName ?? null,
    weightGrams: p.weightGrams,
  });

  return (
    <div className="pp">
      <PhoneGallery keys={p.imageKeys} name={p.line.name} />
      {onSale && (
        <div className="pp-flash">
          <span className="pp-flash-l">
            <span className="pp-flash-price">{baht(p.priceSatang)}</span>
            <s>{baht(p.compareAtSatang ?? 0)}</s>
            <span className="pp-flash-pct">-{pct}%</span>
          </span>
          <span className="pp-flash-r">
            <b>FLASH SALE</b>
            <Countdown endsAt={p.saleEndsAt ?? 0} />
          </span>
        </div>
      )}
      <div className={onSale ? "pp-top pp-top--sale" : "pp-top"}>
        {!onSale && <p className="pp-price">{p.rangeText ?? baht(p.priceSatang)}</p>}
        <h1 className="pp-name">{p.line.name}</h1>
        <div className="pp-pills">
          {p.categoryName && <span className="pp-pill">{p.categoryName}</span>}
          {p.line.brandName && <span className="pp-pill">{p.line.brandName}</span>}
          {p.onHand > 0 && (
            <span className="pp-ready">
              <span className="pp-dot" />
              พร้อมส่ง
            </span>
          )}
        </div>
      </div>
      {p.rangeText !== null && (
        <div className="pp-flat pp-choices">
          <ChoicesRow choices={p.choices} />
        </div>
      )}
      <CarFit fitments={p.fitments} brands={p.carBrands} models={p.carModels} />
      {specs.length > 0 && (
        <section className="pp-group" aria-label="รายละเอียดสินค้า">
          <div className="pp-head">
            <h2 className="pp-ct">รายละเอียดสินค้า</h2>
          </div>
          <div className="pp-card">
            {specs.map((s) => (
              <div key={s.label} className="pp-kv">
                <span>{s.label}</span>
                <span>{s.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <InfoCard
        warrantyDays={p.warrantyDays}
        warrantyText={p.warrantyText}
        terms={p.terms}
        categoryName={p.categoryName}
      />
      {p.description && (
        <section className="pp-group" aria-label="คำอธิบาย">
          <div className="pp-head">
            <h2 className="pp-ct">คำอธิบาย</h2>
          </div>
          <div className="pp-card pp-text">
            <p className="pp-pre">{p.description}</p>
          </div>
        </section>
      )}
      {p.related.length > 0 && (
        <section className="pp-related" aria-label="สินค้าใกล้เคียง">
          <div className="pp-head">
            <h2 className="pp-ct">สินค้าใกล้เคียง</h2>
          </div>
          <div className="hm-grid2">
            {p.related.map((item) => (
              <PhoneCard key={item.variantId} item={item} />
            ))}
          </div>
        </section>
      )}
      <PhoneBuyBar line={p.line} onHand={p.onHand} />
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { apiBase, type ProductDetail, type Fitment } from "@/lib/api";
import { mmToCm } from "@/lib/parcel";
import { tierProfits } from "@/lib/tierProfits";
import { BarcodePreview } from "./BarcodePreview";
import { CopyButton } from "./CopyButton";
import { ProfitPeek } from "./ProfitPeek";
import { canSeeProfit } from "@l-shopee/core";
import { channelTags } from "@/lib/productStatus";
import { useStaffRole } from "../StaffRoleProvider";
import { useT } from "../LangProvider";

const n0 = (x: number | undefined | null): number => (Number.isFinite(x) ? (x as number) : 0);
const thb = (satang: number) => (n0(satang) / 100).toFixed(2);
const baht = (satang: number) => `฿${thb(satang)}`;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{children}</div>
    </div>
  );
}

const groupHead = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 12,
} as const;

function PriceProfit({ price, profit }: { price: number; profit: number | null }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {baht(price)}
      {profit !== null && <ProfitPeek value={profit} />}
    </span>
  );
}

function yearStr(f: Fitment): string {
  if (f.yearFrom && f.yearTo) return `${f.yearFrom}–${f.yearTo}`;
  if (f.yearFrom) return `${f.yearFrom}+`;
  if (f.yearTo) return `–${f.yearTo}`;
  return "";
}

/** View-mode gallery: a 350px main image (defaults to the cover) with thumbnails to switch. */
function StaticFrames({ images, name }: { images: ProductDetail["images"]; name: string }) {
  const t = useT();
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <span
        style={{
          width: 350,
          height: 350,
          borderRadius: 12,
          background: "var(--hover)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-faint)",
          fontSize: 72,
        }}
      >
        📦
      </span>
    );
  }

  const idx = Math.min(active, images.length - 1);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
      {/* Column 1 — big frame */}
      <div
        style={{
          width: 350,
          height: 350,
          flex: "0 0 auto",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--hover)",
        }}
      >
        <img
          src={`${apiBase}/img/${images[idx].imageKey}`}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
      {/* Column 2 — all thumbnails */}
      {images.length > 1 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexWrap: "wrap",
            height: 350,
            alignContent: "flex-start",
            gap: 10,
          }}
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={t({
                th: `ดูรูปที่ ${i + 1}${i === 0 ? " (รูปหน้าปก)" : ""}`,
                en: `Show image ${i + 1}${i === 0 ? " (cover)" : ""}`,
              })}
              style={{
                width: 110,
                height: 110,
                padding: 0,
                minHeight: 0,
                borderRadius: 10,
                overflow: "hidden",
                background: "var(--hover)",
                border: i === idx ? "2px solid var(--primary)" : "1px solid var(--border)",
              }}
            >
              <img
                src={`${apiBase}/img/${img.imageKey}`}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const overviewGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
  gap: "20px 36px",
  alignItems: "start",
} as const;

/**
 * Read-only product overview: gallery, part & stock, identifiers, pricing (profit behind a
 * press-and-hold peek) and fitments. Shared by the product view page (`/products/[id]`) and the
 * edit page's view mode, so the two never drift.
 */
export function ProductView({ detail }: { detail: ProductDetail }) {
  const t = useT();
  const p = detail.product;
  const pr = detail.pricing;
  const held = detail.held ?? 0;
  // A mechanic sees the selling prices but not the margin (owner, 2026-08-24). The API withholds
  // the cost from them, so the figures below would read as full profit — hide the reveal entirely
  // rather than show a number computed from a zero.
  const role = useStaffRole();
  const seesProfit = !!role && canSeeProfit(role);

  // Profits from the saved pricing (view mode).
  const vShopee = n0(pr?.shopeePriceSatang);
  // One shared formula (lib/tierProfits): the four tiers share only the cost, and the marketplace
  // commission is Shopee's alone, charged on its own price.
  const vProfit = tierProfits({
    costSatang: n0(pr?.itemCostSatang),
    taxOnCost: Boolean(pr?.taxOnCost),
    b2cSatang: n0(pr?.targetPriceSatang),
    b2bSatang: n0(pr?.b2bPriceSatang),
    airplusSatang: n0(pr?.onlinePriceSatang),
    shopeeSatang: vShopee,
    commissionBp: n0(pr?.onlineCommissionBp),
  });
  const vOnlineProfit = pr ? vProfit.airplus : 0;
  const vShopeeProfit = pr ? vProfit.shopee : 0;
  const vB2cProfit = pr ? vProfit.b2c : 0;
  const vB2bProfit = pr ? vProfit.b2b : 0;

  // Part-detail tags: prefer the structured brand/system/part, else split the legacy category text.
  const structured = [p.brandName, p.usageName, p.typeName].filter(Boolean) as string[];
  const partTags = structured.length
    ? structured
    : p.category
      ? p.category.split(" · ").filter(Boolean)
      : [];

  return (
    <>
      <div style={{ margin: "12px 0 18px" }}>
        <StaticFrames images={detail.images} name={p.name} />
      </div>
      {p.description && (
        <p className="muted" style={{ margin: "-6px 0 18px", fontSize: 14 }}>
          {p.description}
        </p>
      )}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "16px 18px",
          background: "var(--surface)",
        }}
      >
        <div style={overviewGrid}>
          {/* Column 1 — Part & stock */}
          <div>
            <div style={groupHead}>{t({ th: "อะไหล่และสต็อก", en: "Part & Stock" })}</div>
            <Field label={t({ th: "รายละเอียดอะไหล่", en: "Part details" })}>
              {partTags.length ? (
                <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
                  {partTags.map((t, i) => (
                    <span key={i} className="tag">
                      {t}
                    </span>
                  ))}
                </span>
              ) : (
                "—"
              )}
            </Field>
            {/* Two figures, per the owner's design: what can be sold, and what is paused. Held
                stock is already excluded from on-hand (holds are negative ledger deltas). */}
            <Field label={t({ th: "คงเหลือ", en: "Stock on hand" })}>
              <strong style={{ fontSize: 20 }}>{detail.onHand ?? 0}</strong>
            </Field>
            <Field label={t({ th: "ถูกจอง", en: "Stock on hold" })}>
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                <strong
                  style={{ fontSize: 20, color: held > 0 ? "var(--text)" : "var(--text-faint)" }}
                >
                  {held}
                </strong>
                {held > 0 && (
                  <span className="muted" style={{ fontSize: 12 }}>
                    {t({ th: "กันไว้ — ไม่ได้ขาย", en: "paused — not for sale" })}
                  </span>
                )}
              </span>
            </Field>
            <Field label={t({ th: "น้ำหนัก", en: "Weight" })}>
              {p.weightGrams ? `${p.weightGrams / 1000} kg` : "—"}
            </Field>
            {/* Box size feeds the shipping-fee calc (volumetric weight w×l×h/5000), alongside
                weight — shown here read-only so the parcel data is visible without opening Edit. */}
            <Field label={t({ th: "ขนาดกล่อง (ก×ย×ส)", en: "Box size (W×L×H)" })}>
              {p.widthMm && p.lengthMm && p.heightMm
                ? `${mmToCm(p.widthMm)} × ${mmToCm(p.lengthMm)} × ${mmToCm(p.heightMm)} cm`
                : "—"}
            </Field>
          </div>

          {/* Column 2 — Identifiers */}
          <div>
            <div style={groupHead}>{t({ th: "รหัสอ้างอิง", en: "Identifiers" })}</div>
            <Field label={t({ th: "รหัสสินค้า", en: "Product ID" })}>
              {p.productRef ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {p.productRef}
                    <CopyButton
                      value={p.productRef}
                      label={t({ th: "รหัสสินค้า", en: "Product ID" })}
                    />
                  </span>
                  <BarcodePreview value={p.productRef} />
                </div>
              ) : (
                "—"
              )}
            </Field>
            {/* "Shopee ID" was removed on 2026-08-24 (owner): there is no Shopee API to link an id
                to, so the field was permanently "—" and taught nobody anything. */}
            <Field label={t({ th: "สถานะ", en: "Status" })}>
              <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
                {channelTags(p.status, p.shopeeListed).map((tag) => (
                  <span key={tag.label.en} className={`pill ${tag.cls}`}>
                    {t(tag.label)}
                  </span>
                ))}
              </span>
            </Field>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))",
          gap: 18,
          alignItems: "start",
        }}
      >
        {/* Pricing — left column */}
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "12px 16px",
            background: "var(--surface)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t({ th: "ราคา", en: "Pricing" })}</div>
          {[
            {
              label: "Den Air Service",
              price: n0(pr?.targetPriceSatang),
              profit: seesProfit ? vB2cProfit : null,
            },
            { label: "B2B", price: n0(pr?.b2bPriceSatang), profit: seesProfit ? vB2bProfit : null },
            {
              label: "AirPlus",
              price: n0(pr?.onlinePriceSatang),
              profit: seesProfit ? vOnlineProfit : null,
            },
            { label: "AC on Sales", price: vShopee, profit: seesProfit ? vShopeeProfit : null },
          ].map((t) => (
            <div
              key={t.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "10px 0",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div className="muted" style={{ width: 150, flexShrink: 0 }}>
                {t.label}
              </div>
              <div>{pr ? <PriceProfit price={t.price} profit={t.profit} /> : "—"}</div>
            </div>
          ))}
        </div>

        {/* Fits these cars — right column */}
        {detail.fitments.length > 0 && (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "12px 16px",
              background: "var(--surface)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              {t({ th: "ใช้ได้กับรถรุ่นนี้", en: "Fits these cars" })}
            </div>
            <table className="ftbl">
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "34%" }} />
                <col style={{ width: "32%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>{t({ th: "ยี่ห้อ", en: "Brand" })}</th>
                  <th>{t({ th: "รุ่น", en: "Model" })}</th>
                  <th>{t({ th: "ปี", en: "Years" })}</th>
                </tr>
              </thead>
              <tbody>
                {detail.fitments.map((f, i) => (
                  <tr key={i}>
                    <td>{f.carBrand || "—"}</td>
                    <td>{f.carModel || "—"}</td>
                    <td>{yearStr(f) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { apiBase, type ProductDetail, type Fitment } from "@/lib/api";
import { mmToCm } from "@/lib/parcel";
import { totalCostSatang, commissionFeeSatang, profitSatang } from "@/lib/pricing";
import { BarcodePreview } from "./BarcodePreview";
import { CopyButton } from "./CopyButton";
import { ProfitPeek } from "./ProfitPeek";

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

function PriceProfit({ price, profit }: { price: number; profit: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {baht(price)}
      <ProfitPeek value={profit} />
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
              aria-label={`Show image ${i + 1}${i === 0 ? " (cover)" : ""}`}
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
  const p = detail.product;
  const pr = detail.pricing;

  // Profits from the saved pricing (view mode).
  const vTC = pr ? totalCostSatang(pr.itemCostSatang, Boolean(pr.taxOnCost)) : 0;
  const vOnlineProfit = pr
    ? profitSatang(
        pr.onlinePriceSatang,
        vTC,
        commissionFeeSatang(pr.onlinePriceSatang, pr.onlineCommissionBp),
      )
    : 0;
  const vB2cProfit = pr ? profitSatang(pr.targetPriceSatang, vTC, 0) : 0;
  const vB2bProfit = pr ? profitSatang(pr.b2bPriceSatang, vTC, 0) : 0;

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
            <div style={groupHead}>Part &amp; Stock</div>
            <Field label="Part details">
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
            <Field label="Stock on hand">
              <strong style={{ fontSize: 20 }}>{detail.onHand ?? 0}</strong>
            </Field>
            {/* "Stock on hold" is added here once the On-hold feature lands (it introduces the
                held bucket + the API field); until then there is no held stock to show. */}
            <Field label="Weight">{p.weightGrams ? `${p.weightGrams / 1000} kg` : "—"}</Field>
            {/* Box size feeds the shipping-fee calc (volumetric weight w×l×h/5000), alongside
                weight — shown here read-only so the parcel data is visible without opening Edit. */}
            <Field label="Box size (W×L×H)">
              {p.widthMm && p.lengthMm && p.heightMm
                ? `${mmToCm(p.widthMm)} × ${mmToCm(p.lengthMm)} × ${mmToCm(p.heightMm)} cm`
                : "—"}
            </Field>
          </div>

          {/* Column 2 — Identifiers */}
          <div>
            <div style={groupHead}>Identifiers</div>
            <Field label="Product ID">
              {p.productRef ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {p.productRef}
                    <CopyButton value={p.productRef} label="Product ID" />
                  </span>
                  <BarcodePreview value={p.productRef} />
                </div>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Shopee ID">
              {p.shopeeItemId ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {p.shopeeItemId}
                  <CopyButton value={p.shopeeItemId} label="Shopee ID" />
                </span>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Shopee">
              <span className={p.shopeeListed ? "pill on" : "pill off"}>
                {p.shopeeListed ? "Active on Shopee" : "Not listed"}
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
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Pricing</div>
          {[
            {
              label: "Online · default",
              price: n0(pr?.onlinePriceSatang),
              profit: vOnlineProfit,
            },
            { label: "On-site · B2C", price: n0(pr?.targetPriceSatang), profit: vB2cProfit },
            { label: "On-site · B2B", price: n0(pr?.b2bPriceSatang), profit: vB2bProfit },
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
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Fits these cars</div>
            <table className="ftbl">
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "34%" }} />
                <col style={{ width: "32%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>Years</th>
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

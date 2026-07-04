"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  lookupBarcode,
  fetchProducts,
  fetchBarcodes,
  fetchServices,
  fetchShopInfo,
  fetchSales,
  fetchCarFitment,
  imageUrl,
  saveDraft,
  listDrafts,
  deleteDraft,
  getOnsiteSale,
  EMPTY_SHOP_INFO,
  type ProductRow,
  type ServiceRow,
  type ShopInfo,
  type CarBrandTree,
  type OpenDraft,
} from "@/lib/api";
import { cartToDraftLines, draftToCartLines } from "@/lib/posDraft";
import JsBarcode from "jsbarcode";
import { formatBaht } from "@/lib/format";
import { productDisplayName } from "@/lib/productLabel";
import { nextSalesId, latestSalesIdForDay } from "@/lib/salesId";
import { SHOP_DEFAULTS } from "@/lib/shopDefaults";
import {
  lineTotalSatang,
  cartTotalSatang,
  discountSatangOf,
  distributeDiscount,
  type DiscountKind,
} from "@/lib/posCart";
import { inputL, inputS } from "@/lib/inputStyles";
import { ServiceSelect } from "./ServiceSelect";
import {
  flushOutbox,
  formatSyncFailureMessage,
  isSyncSuccess,
  type OutboxStore,
  type QueuedSale,
  type SyncResponse,
} from "@/lib/outbox";
import { apiFetch } from "@/lib/apiFetch";
import { createIdbStore } from "@/lib/outbox-idb";
import { useToast } from "../ToastProvider";

type SaleType = "parts" | "repair";
type AddKind = "product" | "service" | "addon";
type AddMethod = "scan" | "code" | "search";
type LineKind = "part" | "service";
type PriceTier = "retail" | "wholesale";
type BillLang = "th" | "en";

interface SaleLine {
  uid: string;
  kind: LineKind;
  name: string;
  nameEn?: string; // English name for catalog services; the bill prints it when lang=en
  productVariantId?: string | null;
  barcodeValue?: string;
  productRef?: string;
  tags?: string[]; // part detail tags (brand · system · part name)
  quantity: number;
  unitPriceSatang: number;
  b2cPriceSatang?: number; // retail price
  b2bPriceSatang?: number; // wholesale price
  tier?: PriceTier; // per-line B2C/B2B choice
  unitCostSatang?: number; // product cost — sent to the server for gross-profit
}

async function syncSale(sale: QueuedSale): Promise<{ ok: boolean; message?: string }> {
  const res = await apiFetch("/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sales: [sale] }),
  });
  if (!res.ok) {
    return { ok: false, message: `Server error (HTTP ${res.status})` };
  }
  const body = (await res.json()) as SyncResponse;
  if (!isSyncSuccess(body)) {
    return { ok: false, message: formatSyncFailureMessage(body) };
  }
  return { ok: true };
}

const card: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "14px 16px",
};
const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginBottom: 10,
};
// Input-box size patterns (inputL / inputS) live in @/lib/inputStyles — shared app-wide.

/** Local date as yyyy-mm-dd (for a <input type="date"> default). */
function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** A yyyy-mm-dd string as a Thai long date (Buddhist era), e.g. 25 มิถุนายน 2569. */
function thaiDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

/** English-locale date for the EN bill (e.g. 26 June 2026). */
function englishDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function Seg({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 9,
        border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
        background: active ? "var(--primary)" : "var(--surface)",
        color: active ? "#fff" : "var(--text)",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        minHeight: 0,
      }}
    >
      {children}
    </button>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: "1px solid transparent",
        background: active ? "var(--primary-soft)" : "transparent",
        color: active ? "var(--primary)" : "var(--text-muted)",
        fontWeight: active ? 600 : 500,
        fontSize: 13,
        cursor: "pointer",
        minHeight: 0,
      }}
    >
      {children}
    </button>
  );
}

/** Plain 20px group headline for the POS builder steps (Setup → Info → Items). Also a scroll anchor
 *  (`pos-step-<n>`) the StepTimeline jumps to; scrollMarginTop clears the 56px sticky topbar plus the
 *  frozen ~50px timeline below it, so a jumped-to heading lands just under the frozen chrome. */
function StepHead({ n, label }: { n: number; label: string }) {
  return (
    <div
      id={`pos-step-${n}`}
      className="pos-step-anchor"
      style={{
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1.1,
        color: "var(--text)",
      }}
    >
      {label}
    </div>
  );
}

/** Clickable horizontal step timeline at the top of the POS builder — jumps to each group. */
const POS_STEPS = [
  { n: 1, label: "Setup" },
  { n: 2, label: "Info" },
  { n: 3, label: "Items" },
] as const;

function StepTimeline() {
  const go = (n: number) =>
    document
      .getElementById(`pos-step-${n}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  // Frozen below the 56px topbar; the Setup/Info/Items groups scroll behind it.
  // Opaque --bg masks the scrolling cards; paddingBottom keeps the 24px gap to Setup.
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        position: "sticky",
        top: 56,
        zIndex: 4,
        background: "var(--bg)",
        paddingBottom: 10,
      }}
    >
      {POS_STEPS.map((s, i) => (
        <Fragment key={s.n}>
          <button
            type="button"
            onClick={() => go(s.n)}
            title={`Go to ${s.label}`}
            aria-label={`Go to ${s.label}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 999,
              background: "var(--primary)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              border: 0,
              padding: 0,
              cursor: "pointer",
              minHeight: 0,
              flex: "0 0 auto",
            }}
          >
            {s.n}
          </button>
          {i < POS_STEPS.length - 1 && (
            <div
              style={{
                flex: 1,
                height: 2,
                borderRadius: 2,
                background: "var(--border)",
                margin: "0 10px",
              }}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}

function chip(kind: "part" | "service"): CSSProperties {
  if (kind === "service") {
    return {
      fontSize: 11,
      fontWeight: 600,
      padding: "2px 7px",
      borderRadius: 5,
      background: "var(--primary-soft)",
      color: "var(--primary)",
      whiteSpace: "nowrap",
    };
  }
  // Part detail tags: match the products table's outlined .tag.tag-sm style.
  return {
    fontSize: 11,
    fontWeight: 400,
    padding: "1px 8px",
    borderRadius: 8,
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text-muted)",
    whiteSpace: "nowrap",
  };
}

/** A small rendered barcode (EAN-13 for 13 digits, else CODE128). Drawn off-screen to a data URL so
 * list re-renders can't blank it; renders nothing if the value won't encode. */
function BarcodePreview({ value }: { value: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!value) {
      setSrc("");
      return;
    }
    const encode = (format: string) => {
      const c = document.createElement("canvas");
      JsBarcode(c, value, {
        format,
        width: 1.3,
        height: 26,
        displayValue: true,
        fontSize: 9,
        margin: 0,
      });
      return c.toDataURL("image/png");
    };
    try {
      // Prefer EAN-13 for 13-digit codes, but fall back to CODE128 when the check digit is invalid.
      setSrc(/^\d{13}$/.test(value) ? encode("EAN13") : encode("CODE128"));
    } catch {
      try {
        setSrc(encode("CODE128"));
      } catch {
        setSrc(""); // value won't encode at all → show nothing
      }
    }
  }, [value]);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={`Barcode ${value}`}
      style={{ maxWidth: 124, height: "auto", display: "block" }}
    />
  );
}

/** One cart line. Row 1: name + detail tags (or Service chip) on the left, barcode on the right.
 * Row 2 (separated by a clear gap): editable ฿ price × qty pcs. on the left, bold line total right. */
function CartItem({
  line,
  lang,
  barcode,
  onQty,
  onPrice,
  onTier,
  onRemove,
}: {
  line: SaleLine;
  lang: BillLang;
  barcode?: string;
  onQty: (q: number) => void;
  onPrice: (satang: number) => void;
  onTier: (t: PriceTier) => void;
  onRemove: () => void;
}) {
  const isService = line.kind === "service";
  const tags = line.tags ?? [];
  const miniInput: CSSProperties = { width: 66, fontSize: 13, padding: "5px 8px", minHeight: 0 };
  return (
    <div
      style={{
        position: "relative",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
        background: "var(--surface)",
      }}
    >
      {/* Row 1: identity — name + tags (left), barcode (right) */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingRight: 28 }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ fontWeight: 600, lineHeight: 1.3 }}>
            {lang === "en" && line.nameEn ? line.nameEn : line.name}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
            {isService ? (
              <span style={chip("service")}>Service</span>
            ) : (
              tags.map((t, i) => (
                <span key={i} style={chip("part")}>
                  {t}
                </span>
              ))
            )}
          </div>
        </div>
        {!isService && barcode && (
          <div style={{ flex: "none", paddingTop: 2 }}>
            <BarcodePreview value={barcode} />
          </div>
        )}
      </div>

      {/* Remove (top-right) */}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 24,
          height: 24,
          minHeight: 0,
          padding: 0,
          lineHeight: 1,
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: "var(--text-muted)",
          cursor: "pointer",
        }}
      >
        ✕
      </button>

      {/* Row 2: per-line price tier (parts) + money (฿ price × qty · total). Divider above. */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        {!isService && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className="muted" style={{ fontSize: 11 }}>
              Price
            </span>
            {(() => {
              // Wholesale switch: off = retail (B2C), on = wholesale (B2B). Flipping reprices the line.
              const wholesale = (line.tier ?? "retail") === "wholesale";
              return (
                <button
                  type="button"
                  role="switch"
                  aria-checked={wholesale}
                  aria-label="Wholesale price (B2B)"
                  onClick={() => onTier(wholesale ? "retail" : "wholesale")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      position: "relative",
                      width: 36,
                      height: 20,
                      borderRadius: 999,
                      background: wholesale
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--text-muted) 30%, transparent)",
                      transition: "background .15s",
                      flex: "none",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: wholesale ? 18 : 2,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "#fff",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                        transition: "left .15s",
                      }}
                    />
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: wholesale ? "var(--primary)" : "var(--text-muted)",
                    }}
                  >
                    Wholesale (B2B)
                  </span>
                </button>
              );
            })()}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            <span>฿</span>
            <input
              type="number"
              min={0}
              value={line.unitPriceSatang / 100}
              onChange={(e) =>
                onPrice(Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)))
              }
              style={miniInput}
              title="Unit price"
            />
            <span>×</span>
            <input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(e) => onQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{ ...miniInput, width: 48, textAlign: "center" }}
              title="Quantity"
            />
            <span>pcs.</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{formatBaht(lineTotalSatang(line))}</div>
        </div>
      </div>
    </div>
  );
}

type BillStyle = "invoice" | "thermal";

/** Amount in baht with grouping + 2 decimals, no symbol (e.g. 2,590.00). */
function amt(satang: number): string {
  return (satang / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type DocType = "bill" | "quotation";

/** The in-progress POS cart, saved locally so a page switch / refresh doesn't lose it. */
const DRAFT_KEY = "pos:draft:v1";
const LAST_SALE_ID_KEY = "pos:lastSaleId:v1";
interface PosDraft {
  lines: SaleLine[];
  plate: string;
  mileage: string;
  note: string;
  billDate: string;
  carBrandId: string;
  carModelId: string;
  carYear: string;
  docType: DocType;
}

/** A mock QR graphic (3 finder patterns + scattered modules). Stands in until the shop uploads a
 * real contact QR in Shop info. Deterministic so it doesn't flicker on re-render. */
function QrPlaceholder({ size = 80 }: { size?: number }) {
  const N = 21;
  const c = size / N;
  const rects: ReactNode[] = [];
  const fill = (x: number, y: number) =>
    rects.push(<rect key={`${x}-${y}`} x={x * c} y={y * c} width={c} height={c} fill="#18181b" />);
  const finder = (ox: number, oy: number) => {
    for (let x = 0; x < 7; x++)
      for (let y = 0; y < 7; y++) {
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || core) fill(ox + x, oy + y);
      }
  };
  finder(0, 0);
  finder(N - 7, 0);
  finder(0, N - 7);
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const inFinder = (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
      if (inFinder) continue;
      if ((x * 7 + y * 13 + x * y * 3) % 5 === 0 || (x + y) % 4 === 0) fill(x, y);
    }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ background: "#fff", display: "block", flex: "none" }}
      aria-label="Contact QR (sample)"
    >
      {rects}
    </svg>
  );
}

/** The printable cash bill, rendered as a thermal receipt or a structured invoice. */
function BillDoc({
  billStyle,
  docType,
  lang,
  shop,
  dateLabel,
  saleNumber,
  vehicle,
  plate,
  mileage,
  lines,
  subtotalSatang,
  discountSatang,
  totalSatang,
  note,
}: {
  billStyle: BillStyle;
  docType: DocType;
  lang: BillLang;
  shop: ShopInfo;
  dateLabel: string;
  saleNumber: string;
  vehicle: string;
  plate: string;
  mileage: string;
  lines: SaleLine[];
  subtotalSatang: number;
  discountSatang: number;
  totalSatang: number;
  note: string;
}) {
  const muted = "#6b7280";
  const empty = lines.length === 0;
  const isQuote = docType === "quotation";
  const en = lang === "en";
  const headEn = isQuote ? "QUOTATION" : "CASH BILL";
  const headTh = isQuote ? "ใบเสนอราคา" : "บิลเงินสด";

  // Pick the Thai or English value, falling back to Thai when the English one is blank.
  const pick = (th: string, enVal: string) => (en && enVal.trim() ? enVal : th);
  const shopName = pick(shop.name, shop.nameEn) || "—";
  const shopAddress = pick(shop.address, shop.addressEn);
  const quoteNote = pick(shop.quoteNote || SHOP_DEFAULTS.quoteNote, shop.quoteNoteEn);
  const qrHeadline = pick(shop.qrHeadline || SHOP_DEFAULTS.qrHeadline, shop.qrHeadlineEn);
  const qrSubtitle = pick(shop.qrSubtitle || SHOP_DEFAULTS.qrSubtitle, shop.qrSubtitleEn);

  // Structural labels. The Thai column is byte-identical to the previous hardcoded strings, so the
  // Thai bill is unchanged; only the English path is new.
  const t = en
    ? {
        saleId: "Sales ID",
        date: "Date",
        vehicle: "Vehicle",
        plate: "Plate",
        mileage: "Mileage",
        item: "Item",
        qty: "Qty",
        price: "Price",
        amount: "Amount",
        empty: "No items yet",
        subtotal: "Subtotal",
        discount: "Discount",
        grandCash: "Total",
        grandQuote: "Estimate",
        note: "Note",
        thanks: "*** Thank you ***",
      }
    : {
        saleId: "เลขที่บิล",
        date: "วันที่",
        vehicle: "รถ",
        plate: "ทะเบียน",
        mileage: "เลขไมล์",
        item: "รายการ",
        qty: "จำนวน",
        price: "ราคา",
        amount: "รวม",
        empty: "ยังไม่มีรายการ",
        subtotal: "รวมย่อย",
        discount: "ส่วนลด",
        grandCash: "รวมทั้งสิ้น",
        grandQuote: "รวมโดยประมาณ",
        note: "หมายเหตุ",
        thanks: "*** ขอบคุณที่ใช้บริการ ***",
      };

  // Contact QR: the uploaded image when set, otherwise the sample placeholder.
  const qrNode = (size: number) =>
    shop.qrKey ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl(shop.qrKey)}
        alt="Contact QR"
        width={size}
        height={size}
        style={{ display: "block", objectFit: "contain" }}
      />
    ) : (
      <QrPlaceholder size={size} />
    );

  if (billStyle === "thermal") {
    const dash = <div style={{ borderTop: "1.5px dashed #9aa0a6", margin: "11px 0" }} />;
    const metaRow = (label: string, value: string) => (
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span style={{ color: muted }}>{label}</span>
        <span>{value}</span>
      </div>
    );
    return (
      <div
        style={{
          maxWidth: 320,
          margin: "0 auto",
          background: "#fff",
          color: "#18181b",
          fontSize: 12.5,
          lineHeight: 1.5,
          padding: "20px 18px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 2 }}>{headEn}</div>
          <div style={{ fontSize: 11, color: muted }}>{headTh}</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>{shopName}</div>
          {!isQuote && shopAddress && (
            <div style={{ fontSize: 11, color: "#52525b", whiteSpace: "pre-wrap" }}>
              {shopAddress}
            </div>
          )}
        </div>
        {dash}
        {saleNumber && metaRow(t.saleId, saleNumber)}
        {metaRow(t.date, dateLabel)}
        {vehicle && metaRow(t.vehicle, vehicle)}
        {plate && metaRow(t.plate, plate)}
        {mileage && metaRow(t.mileage, `${mileage} km`)}
        {dash}
        {empty ? (
          <div style={{ color: muted, padding: "4px 0" }}>{t.empty}</div>
        ) : (
          lines.map((l) => (
            <div key={l.uid} style={{ marginBottom: 6 }}>
              <div>{pick(l.name, l.nameEn ?? "")}</div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#3f3f46" }}>
                <span style={{ color: muted }}>×{l.quantity}</span>
                <span>{amt(lineTotalSatang(l))}</span>
              </div>
            </div>
          ))
        )}
        {dash}
        {discountSatang > 0 && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: muted,
              }}
            >
              <span>{t.subtotal}</span>
              <span>฿{amt(subtotalSatang)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: muted,
                marginBottom: 3,
              }}
            >
              <span>{t.discount}</span>
              <span>−฿{amt(discountSatang)}</span>
            </div>
          </>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          <span>{isQuote ? t.grandQuote : t.grandCash}</span>
          <span>฿{amt(totalSatang)}</span>
        </div>
        {isQuote && <div style={{ fontSize: 10.5, color: muted, marginTop: 4 }}>{quoteNote}</div>}
        {note && (
          <>
            {dash}
            <div style={{ fontSize: 11, color: "#52525b" }}>
              {t.note}: {note}
            </div>
          </>
        )}
        {isQuote ? (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <div style={{ display: "inline-block" }}>{qrNode(92)}</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{qrHeadline}</div>
            <div style={{ fontSize: 11, color: muted }}>{qrSubtitle}</div>
          </div>
        ) : (
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: muted }}>
            {t.thanks}
          </div>
        )}
      </div>
    );
  }

  // Invoice
  // Shared totals stack (subtotal/discount when discounted, then the grand total). On a quotation it
  // sits to the right of the contact QR; on a cash bill it's the full-width right-aligned total row.
  const totalsBlock = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      {discountSatang > 0 && (
        <>
          <div style={{ display: "flex", gap: 24, fontSize: 12, color: muted }}>
            <span>Subtotal</span>
            <span>฿{amt(subtotalSatang)}</span>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 12, color: muted }}>
            <span>Discount</span>
            <span>−฿{amt(discountSatang)}</span>
          </div>
        </>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
        <span style={{ fontWeight: 700, letterSpacing: 1 }}>{isQuote ? "ESTIMATE" : "TOTAL"}</span>
        <span style={{ fontSize: 19, fontWeight: 700 }}>฿{amt(totalSatang)}</span>
      </div>
    </div>
  );
  return (
    <div
      style={{
        background: "#fff",
        color: "#18181b",
        fontSize: 13,
        border: "1px solid #d4d4d8",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          padding: "16px 18px",
          borderBottom: "2px solid #18181b",
        }}
      >
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{shopName}</div>
          {!isQuote && shopAddress && (
            <div
              style={{ fontSize: 12, color: "#52525b", lineHeight: 1.5, whiteSpace: "pre-wrap" }}
            >
              {shopAddress}
            </div>
          )}
          {isQuote && (
            <div style={{ fontSize: 12, color: "#52525b", lineHeight: 1.5 }}>{quoteNote}</div>
          )}
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div
            style={{
              display: "inline-block",
              background: "#18181b",
              color: "#fff",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: 1.5,
              padding: "5px 11px",
              borderRadius: 4,
            }}
          >
            {headEn}
          </div>
          <div style={{ fontSize: 12, color: "#52525b", marginTop: 7 }}>{dateLabel}</div>
          {saleNumber && (
            <div style={{ fontSize: 12, color: "#52525b", marginTop: 2 }}>
              {t.saleId}: {saleNumber}
            </div>
          )}
        </div>
      </div>
      {(vehicle || plate || mileage) && (
        <div
          style={{
            display: "flex",
            gap: 28,
            flexWrap: "wrap",
            padding: "10px 18px",
            background: "#f4f4f5",
            fontSize: 12,
          }}
        >
          {vehicle && (
            <div>
              <span style={{ color: muted }}>{t.vehicle}:</span> {vehicle}
            </div>
          )}
          {plate && (
            <div>
              <span style={{ color: muted }}>{t.plate}:</span> {plate}
            </div>
          )}
          {mileage && (
            <div>
              <span style={{ color: muted }}>{t.mileage}:</span> {mileage} km
            </div>
          )}
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#fafafa", color: muted, fontSize: 11 }}>
            <th style={{ textAlign: "left", padding: "8px 8px 8px 18px", fontWeight: 600 }}>
              {t.item}
            </th>
            <th style={{ textAlign: "center", padding: 8, fontWeight: 600 }}>{t.qty}</th>
            <th style={{ textAlign: "right", padding: 8, fontWeight: 600 }}>{t.price}</th>
            <th style={{ textAlign: "right", padding: "8px 18px 8px 8px", fontWeight: 600 }}>
              {t.amount}
            </th>
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={4} style={{ padding: "14px 18px", color: "#9aa0a6" }}>
                {t.empty}
              </td>
            </tr>
          ) : (
            lines.map((l) => (
              <tr key={l.uid} style={{ borderBottom: "1px solid #efefef" }}>
                <td style={{ padding: "9px 8px 9px 18px" }}>{pick(l.name, l.nameEn ?? "")}</td>
                <td style={{ textAlign: "center", padding: 9 }}>{l.quantity}</td>
                <td style={{ textAlign: "right", padding: 9 }}>{amt(l.unitPriceSatang)}</td>
                <td style={{ textAlign: "right", padding: "9px 18px 9px 8px" }}>
                  {amt(lineTotalSatang(l))}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {isQuote ? (
        // Quotation footer: contact QR on the left, the estimate total on the right — one row.
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 18,
            padding: "12px 18px",
            borderTop: "2px solid #18181b",
            background: "#fafafa",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {qrNode(56)}
            <div>
              <div style={{ fontWeight: 600 }}>{qrHeadline}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{qrSubtitle}</div>
            </div>
          </div>
          {totalsBlock}
        </div>
      ) : (
        <div
          style={{
            padding: "10px 18px",
            borderTop: "2px solid #18181b",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {totalsBlock}
        </div>
      )}
      {note && (
        <div
          style={{
            padding: "10px 18px",
            borderTop: "1px solid #e5e5e5",
            fontSize: 12,
            color: "#52525b",
          }}
        >
          <div>
            <span style={{ fontWeight: 600 }}>Note:</span> {note}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PosPage() {
  const toast = useToast();

  const [addKind, setAddKind] = useState<AddKind>("product");
  const [method, setMethod] = useState<AddMethod>("scan");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [billDate, setBillDate] = useState(() => toISODate(new Date()));
  const [note, setNote] = useState("");
  const [billStyle, setBillStyle] = useState<BillStyle>("invoice");
  const [docType, setDocType] = useState<DocType>("bill");
  const [billLang, setBillLang] = useState<BillLang>("th"); // Thai default; switch flips the bill

  // Vehicle: brand → model → year, plus the plate.
  const [carBrandId, setCarBrandId] = useState("");
  const [carModelId, setCarModelId] = useState("");
  const [carYear, setCarYear] = useState("");
  const [plate, setPlate] = useState("");
  const [mileage, setMileage] = useState("");
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);

  // Server-parked drafts/quotations: a stable id for the current cart, the one currently reopened
  // (deleted once it finalizes to a bill), the reopen tray, and the QT quotation counter.
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<OpenDraft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [lastQuoteId, setLastQuoteId] = useState<string | null>(null);
  // Reprint mode: reopen a finalized bill read-only to reprint it. NEVER checkoutable (no double
  // sale) — its original number + vehicle print, and only "Create PDF" is offered.
  const [reprint, setReprint] = useState<{ saleNumber: string | null; vehicle: string } | null>(
    null,
  );

  // Reference data (loaded once; scanning falls back to the API when offline/missing).
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [barcodeToProductId, setBarcodeToProductId] = useState<Map<string, string>>(new Map());
  const [codeToBarcode, setCodeToBarcode] = useState<Map<string, string>>(new Map());
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [shop, setShop] = useState<ShopInfo>(EMPTY_SHOP_INFO);
  const [carFitment, setCarFitment] = useState<CarBrandTree[]>([]);

  // Add-part inputs
  const [scanVal, setScanVal] = useState("");
  const [codeVal, setCodeVal] = useState("");
  const [searchQ, setSearchQ] = useState("");

  // Add-on (one-off custom line) inputs
  const [addonName, setAddonName] = useState("");
  const [addonPrice, setAddonPrice] = useState("");

  // Bill pricing options
  const [discountKind, setDiscountKind] = useState<DiscountKind>("thb");
  const [discountValue, setDiscountValue] = useState("");

  // Add-service inputs. svcId is "" or a saved service id; svcPrice prefills from its base price.
  const [svcId, setSvcId] = useState("");
  const [svcPrice, setSvcPrice] = useState("");

  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);

  const storeRef = useRef<OutboxStore | null>(null);
  if (!storeRef.current) storeRef.current = createIdbStore();
  const store = storeRef.current;

  useEffect(() => {
    fetchProducts()
      .then((ps) => setProducts(ps))
      .catch(() => {});
    fetchBarcodes()
      .then((bs) => {
        const byBarcode = new Map<string, string>();
        const byCode = new Map<string, string>();
        for (const b of bs)
          if (b.barcode) {
            byBarcode.set(b.barcode, b.productId);
            byCode.set(b.productRef, b.barcode);
          }
        setBarcodeToProductId(byBarcode);
        setCodeToBarcode(byCode);
      })
      .catch(() => {});
    fetchServices()
      .then((s) => setServices(s))
      .catch(() => {});
    fetchShopInfo()
      .then((s) => setShop(s))
      .catch(() => {});
    fetchCarFitment()
      .then((b) => setCarFitment(b))
      .catch(() => {});
    // Seed the sale-number counter from the server's latest for today, so a fresh device continues
    // past backfilled / other-session numbers instead of restarting at 001. lastSaleId drives the
    // pending number shown on the bill.
    setLastSaleId(localStorage.getItem(LAST_SALE_ID_KEY));
    fetchSales()
      .then((sales) => {
        const seed = latestSalesIdForDay(
          [localStorage.getItem(LAST_SALE_ID_KEY), ...sales.map((s) => s.saleNumber)],
          Date.now(),
        );
        if (seed) {
          localStorage.setItem(LAST_SALE_ID_KEY, seed);
          setLastSaleId(seed);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function flush() {
      const r = await flushOutbox(store, async (sale) => (await syncSale(sale)).ok);
      if (cancelled) return;
      if (r.synced) toast(`Synced ${r.synced} queued sale(s)`, "success");
      if (r.failed)
        toast(`${r.failed} queued sale(s) could not sync — check stock and try again`, "error");
      setPending((await store.all()).length);
    }
    flush();
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  // Auto-save the in-progress draft locally so switching pages / refreshing doesn't lose the cart.
  // A draft is NOT a sale (no revenue) — it's cleared on checkout, when the order goes to the ledger.
  const draftReady = useRef(false);
  useEffect(() => {
    // In reprint mode the cart is a finalized bill loaded read-only — never touch the local draft
    // (don't restore over it, and leave draftReady false so autosave stays off).
    if (new URLSearchParams(window.location.search).has("reprint")) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<PosDraft>;
        if (Array.isArray(d.lines) && d.lines.length) setLines(d.lines);
        if (typeof d.plate === "string") setPlate(d.plate);
        if (typeof d.mileage === "string") setMileage(d.mileage);
        if (typeof d.note === "string") setNote(d.note);
        if (typeof d.billDate === "string") setBillDate(d.billDate);
        if (typeof d.carBrandId === "string") setCarBrandId(d.carBrandId);
        if (typeof d.carModelId === "string") setCarModelId(d.carModelId);
        if (typeof d.carYear === "string") setCarYear(d.carYear);
        if (d.docType === "bill" || d.docType === "quotation") setDocType(d.docType);
      }
    } catch {
      // ignore corrupt or unavailable storage
    }
    // Enable saving only after the restore has settled, so it can't clobber the saved draft on mount.
    const t = setTimeout(() => {
      draftReady.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!draftReady.current) return;
    try {
      const empty =
        lines.length === 0 &&
        !plate.trim() &&
        !mileage.trim() &&
        !note.trim() &&
        !carBrandId &&
        !carModelId &&
        docType === "bill";
      if (empty) {
        localStorage.removeItem(DRAFT_KEY);
      } else {
        const draft: PosDraft = {
          lines,
          plate,
          mileage,
          note,
          billDate,
          carBrandId,
          carModelId,
          carYear,
          docType,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    } catch {
      // ignore storage errors (private mode / quota)
    }
  }, [lines, plate, mileage, note, billDate, carBrandId, carModelId, carYear, docType]);

  // Reprint: ?reprint=<id> loads that finalized bill read-only so it can be re-printed. The original
  // number + vehicle print; the actions collapse to Create PDF only (no checkout → no double sale).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("reprint");
    if (!id) return;
    (async () => {
      try {
        const bill = await getOnsiteSale(id);
        setLines(
          bill.lines.map((l) => ({
            uid: crypto.randomUUID(),
            kind: l.lineType === "service" ? "service" : "part",
            name: l.description ?? "",
            productVariantId: l.productVariantId,
            quantity: l.quantity,
            unitPriceSatang: l.unitPriceSatang,
          })) as SaleLine[],
        );
        setPlate(bill.licensePlate ?? "");
        setNote(bill.notes ?? "");
        setBillDate(toISODate(new Date(bill.createdAt)));
        setDocType(bill.stage === "quotation" ? "quotation" : "bill");
        if (bill.discountTotalSatang > 0) {
          setDiscountKind("thb");
          setDiscountValue(String(bill.discountTotalSatang / 100));
        }
        setReprint({ saleNumber: bill.saleNumber, vehicle: bill.vehicle ?? "" });
      } catch {
        toast("Couldn't load the bill to reprint.", "error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotalSatang = cartTotalSatang(lines);
  const discountSatang = discountSatangOf(subtotalSatang, discountKind, discountValue);
  const totalSatang = subtotalSatang - discountSatang;

  // Product search (fallback when a barcode/sticker is unreadable) — filter the loaded catalogue,
  // and hide anything already in the cart (matched by variant, falling back to product code).
  const inCart = new Set(
    lines.filter((l) => l.kind === "part").map((l) => l.productVariantId ?? l.productRef),
  );
  const searchResults = (() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [] as ProductRow[];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.productRef.toLowerCase().includes(q))
      .filter((p) => !inCart.has(p.variantId ?? p.productRef))
      .slice(0, 8);
  })();
  const tierPrice = (p: ProductRow): number => p.offlinePriceSatang || 0;

  // Vehicle (repair): cascade brand → model → year off the car-fitment tree.
  const selectedBrand = carFitment.find((b) => b.id === carBrandId) ?? null;
  const brandModels = selectedBrand?.models ?? [];
  const selectedModel = brandModels.find((m) => m.id === carModelId) ?? null;
  const yearOptions = (() => {
    const from = selectedModel?.yearFrom;
    const to = selectedModel?.yearTo;
    const hi = to ?? new Date().getFullYear();
    const lo = from ?? hi - 25;
    const years: number[] = [];
    for (let y = hi; y >= lo; y--) years.push(y);
    return years;
  })();
  const vehicleLabel = [selectedBrand?.name, selectedModel?.name, carYear]
    .filter(Boolean)
    .join(" ");

  function addProductLine(p: ProductRow, barcodeValue?: string) {
    // The item name carries its brand inline ("Compressor · Denso"); no brand → just the name.
    // Brand moves out of the detail chips so it isn't shown twice.
    const tags = [p.usageName, p.typeName].filter((t): t is string => !!t);
    const barcode = barcodeValue ?? codeToBarcode.get(p.productRef);
    const b2c = p.offlinePriceSatang || 0;
    const b2b = p.b2bPriceSatang || b2c; // fall back to retail when no wholesale price is set
    setLines((ls) => {
      const existing = ls.find((l) => l.kind === "part" && l.productVariantId === p.variantId);
      if (existing && p.variantId) {
        return ls.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...ls,
        {
          uid: crypto.randomUUID(),
          kind: "part",
          name: productDisplayName(p.name, p.brandName),
          productVariantId: p.variantId,
          barcodeValue: barcode,
          productRef: p.productRef,
          tags,
          quantity: 1,
          unitPriceSatang: b2c,
          b2cPriceSatang: b2c,
          b2bPriceSatang: b2b,
          tier: "retail",
          unitCostSatang: p.itemCostSatang || 0,
        },
      ];
    });
    toast(`Added ${p.name}`, "success");
  }

  /** Switch one line between B2C/B2B and reprice it. */
  function setLineTier(uid: string, t: PriceTier) {
    setLines((ls) =>
      ls.map((l) =>
        l.uid === uid
          ? {
              ...l,
              tier: t,
              unitPriceSatang:
                t === "wholesale"
                  ? (l.b2bPriceSatang ?? l.unitPriceSatang)
                  : (l.b2cPriceSatang ?? l.unitPriceSatang),
            }
          : l,
      ),
    );
  }

  async function addByScan() {
    const v = scanVal.trim();
    if (!v) return;
    const pid = barcodeToProductId.get(v);
    const local = pid ? products.find((p) => p.id === pid) : undefined;
    if (local) {
      addProductLine(local, v);
      setScanVal("");
      return;
    }
    setBusy(true);
    try {
      const found = await lookupBarcode(v);
      if (!found) {
        toast(`Unknown barcode: ${v}`, "error");
        return;
      }
      const prod = products.find((p) => p.id === found.productId);
      const tags = prod
        ? [prod.brandName, prod.usageName, prod.typeName].filter((t): t is string => !!t)
        : [];
      const b2c = prod?.offlinePriceSatang || 0;
      const b2b = prod?.b2bPriceSatang || b2c;
      setLines((ls) => [
        ...ls,
        {
          uid: crypto.randomUUID(),
          kind: "part",
          name: found.name,
          productVariantId: found.variantId,
          barcodeValue: v,
          productRef: found.productRef,
          tags,
          quantity: 1,
          unitPriceSatang: b2c,
          b2cPriceSatang: b2c,
          b2bPriceSatang: b2b,
          tier: "retail",
          unitCostSatang: prod?.itemCostSatang || 0,
        },
      ]);
      toast(`Added ${found.name}`, "success");
      setScanVal("");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function addByCode() {
    const v = codeVal.trim().toLowerCase();
    if (!v) return;
    const p = products.find((x) => x.productRef.toLowerCase() === v);
    if (!p) {
      toast(`No product with code “${codeVal.trim()}”.`, "error");
      return;
    }
    addProductLine(p);
    setCodeVal("");
  }

  const serviceName = services.find((s) => s.id === svcId)?.name ?? "";
  const serviceNameEn = services.find((s) => s.id === svcId)?.nameEn ?? "";

  function selectService(id: string) {
    setSvcId(id);
    const s = services.find((x) => x.id === id);
    setSvcPrice(s ? (s.basePriceSatang / 100).toString() : "");
  }

  function addService() {
    if (!serviceName) return;
    const price = Math.max(0, Math.round((parseFloat(svcPrice) || 0) * 100));
    setLines((ls) => [
      ...ls,
      {
        uid: crypto.randomUUID(),
        kind: "service",
        name: serviceName,
        nameEn: serviceNameEn,
        quantity: 1,
        unitPriceSatang: price,
      },
    ]);
    toast(`Added ${serviceName}`, "success");
    setSvcId("");
    setSvcPrice("");
  }

  /** Add a one-off custom line (name + price) not in the catalog. No stock is touched. */
  function addAddon() {
    const name = addonName.trim();
    if (!name) return;
    const price = Math.max(0, Math.round((parseFloat(addonPrice) || 0) * 100));
    setLines((ls) => [
      ...ls,
      { uid: crypto.randomUUID(), kind: "service", name, quantity: 1, unitPriceSatang: price },
    ]);
    toast(`Added ${name}`, "success");
    setAddonName("");
    setAddonPrice("");
  }

  function updateLine(uid: string, patch: Partial<SaleLine>) {
    setLines((ls) => ls.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }
  function removeLine(uid: string) {
    setLines((ls) => ls.filter((l) => l.uid !== uid));
  }

  // Save the whole order — parts (deduct stock) and services (labour lines) plus the sale type,
  // plate and note — to the sales ledger. Offline-safe via the outbox; the server dedupes on uuid.
  async function saveSale(saleNo: string): Promise<boolean> {
    // A sale counts as a repair when it has a vehicle/plate or any service line; else it's parts.
    const isRepair = !!(vehicleLabel || plate.trim() || lines.some((l) => l.kind === "service"));
    // Spread the bill discount across the lines so the server's per-line discount + profit is exact.
    const perLineDiscount = distributeDiscount(
      lines.map((l) => l.unitPriceSatang * l.quantity),
      discountSatang,
    );
    const sale: QueuedSale = {
      clientUuid: crypto.randomUUID(),
      saleNumber: saleNo || undefined,
      paymentMethod: "cash",
      saleType: isRepair ? "repair" : "parts",
      licensePlate: plate.trim() || undefined,
      vehicle: vehicleLabel || undefined,
      notes: note.trim() || undefined,
      lines: lines.map((l, i) => ({
        productVariantId: l.kind === "part" ? (l.productVariantId ?? null) : null,
        lineType: l.kind,
        description: l.name,
        barcodeValue: l.barcodeValue,
        quantity: l.quantity,
        unitPriceSatang: l.unitPriceSatang,
        unitCostSatang: l.unitCostSatang,
        discountSatang: perLineDiscount[i] || undefined,
      })),
      queuedAt: Date.now(),
    };
    try {
      const result = await syncSale(sale);
      if (result.ok) return true;
      toast(result.message ?? "Server rejected the sale — check the items and try again.", "error");
      return false;
    } catch {
      await store.add(sale);
      setPending((await store.all()).length);
      toast("Offline — sale saved, will sync when back online.", "info");
      return true;
    }
  }

  function printBill() {
    window.print();
  }

  async function checkout() {
    if (lines.length === 0) return;
    setBusy(true);
    try {
      // The bill already shows this pending number; only advance the counter once the server accepts
      // the sale, so a rejected checkout reuses the same number and none get burned.
      const saleNo = nextSalesId(lastSaleId, Date.now());
      const ok = await saveSale(saleNo);
      if (!ok) return;
      printBill(); // prints saleNo — the counter hasn't advanced yet
      localStorage.setItem(LAST_SALE_ID_KEY, saleNo);
      setLastSaleId(saleNo);
      // Finalizing a reopened draft/quotation converts it to this bill — drop the parked copy.
      if (activeDraftId) {
        await deleteDraft(activeDraftId).catch(() => {});
        setActiveDraftId(null);
      }
      setDraftId(crypto.randomUUID()); // the next cart is a fresh draft
      toast("Sale saved ✓", "success");
      setLines([]);
      setPlate("");
      setMileage("");
      setNote("");
      setCarBrandId("");
      setCarModelId("");
      setCarYear("");
      setAddKind("product");
      setAddonName("");
      setAddonPrice("");
      setBillDate(toISODate(new Date()));
      // Reset bill options + inputs so nothing carries to the next customer (esp. the discount).
      setDiscountValue("");
      setDiscountKind("thb");
      setSearchQ("");
    } finally {
      setBusy(false);
    }
  }

  // ── Server-parked drafts & quotations ──
  function buildDraftInput(stage: "draft" | "quotation", saleNumber?: string) {
    const isRepair = !!(vehicleLabel || plate.trim() || lines.some((l) => l.kind === "service"));
    return {
      draftId,
      stage,
      saleNumber: saleNumber ?? null,
      saleType: (isRepair ? "repair" : "parts") as "repair" | "parts",
      licensePlate: plate.trim() || null,
      vehicle: vehicleLabel || null,
      notes: note.trim() || null,
      lines: cartToDraftLines(lines),
    };
  }

  async function saveDraftNow() {
    if (lines.length === 0) return;
    setBusy(true);
    try {
      await saveDraft(buildDraftInput("draft"));
      setActiveDraftId(draftId);
      toast("Draft saved — reopen it any time.", "success");
    } catch {
      toast("Couldn't save the draft (offline?).", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveQuotationNow() {
    if (lines.length === 0) return;
    setBusy(true);
    try {
      const qtNo = nextSalesId(lastQuoteId, Date.now(), "QT");
      await saveDraft(buildDraftInput("quotation", qtNo));
      setLastQuoteId(qtNo);
      setActiveDraftId(draftId);
      toast(`Quotation ${qtNo} saved ✓`, "success");
    } catch {
      toast("Couldn't save the quotation (offline?).", "error");
    } finally {
      setBusy(false);
    }
  }

  async function openDraftsTray() {
    try {
      setDrafts(await listDrafts());
      setDraftsOpen(true);
    } catch {
      toast("Couldn't load saved drafts.", "error");
    }
  }

  function reopenDraft(d: OpenDraft) {
    setLines(draftToCartLines(d.lines, () => crypto.randomUUID()) as SaleLine[]);
    setPlate(d.licensePlate ?? "");
    setNote(d.notes ?? "");
    setDocType(d.stage === "quotation" ? "quotation" : "bill");
    // The car brand/model/year selects aren't reconstructed from the stored label — plate is the key.
    setCarBrandId("");
    setCarModelId("");
    setCarYear("");
    setDraftId(d.id);
    setActiveDraftId(d.id);
    setDraftsOpen(false);
    toast("Draft reopened.", "success");
  }

  async function discardDraft(d: OpenDraft) {
    try {
      await deleteDraft(d.id);
      setDrafts((ds) => ds.filter((x) => x.id !== d.id));
      if (activeDraftId === d.id) setActiveDraftId(null);
    } catch {
      toast("Couldn't delete the draft.", "error");
    }
  }

  return (
    <main className="pos-page">
      <div
        className="bill-no-print"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <h1 style={{ margin: 0 }}>Point of Sale</h1>
        <button type="button" className="btn-soft" onClick={openDraftsTray}>
          📋 Open drafts{activeDraftId ? " · editing 1" : ""}
        </button>
      </div>
      {pending > 0 && (
        <p style={{ color: "var(--warn)" }} className="bill-no-print">
          ⏳ {pending} sale(s) queued offline — will sync when online.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 528px) minmax(320px, 1fr)",
          gap: 20,
        }}
        className="pos-grid"
      >
        {/* ---- LEFT: build the sale ---- */}
        <div className="pos-col-left" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Clickable step timeline — frozen above the scroll area */}
          <StepTimeline />
          {/* Only these 3 groups scroll; the rest of the page is frozen (wide screens). */}
          <div className="pos-groups-scroll">
            {/* ── Step 1 · Setup — document type, paper, language ── */}
            <div id="pos-group-1" className="pos-step-group">
              <StepHead n={1} label="Setup" />
              <div style={card}>
                {/* Document type — Cash bill vs Quotation */}
                <div
                  className="bill-no-print"
                  style={{ display: "flex", gap: 8, marginBottom: 12 }}
                >
                  {(["bill", "quotation"] as DocType[]).map((d) => {
                    const active = docType === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDocType(d)}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          padding: "11px 10px",
                          borderRadius: 10,
                          border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                          background: active ? "var(--primary)" : "var(--surface)",
                          color: active ? "#fff" : "var(--text)",
                          fontWeight: active ? 600 : 500,
                          fontSize: 14,
                          cursor: "pointer",
                          minHeight: 0,
                        }}
                      >
                        {d === "bill" ? "💵 Cash bill" : "📝 Quotation"}
                      </button>
                    );
                  })}
                </div>

                {/* Paper — Invoice vs Receipt */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)", marginRight: 2 }}>
                    Paper
                  </span>
                  {(["invoice", "thermal"] as BillStyle[]).map((s) => {
                    const active = billStyle === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setBillStyle(s)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 999,
                          border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                          background: active ? "var(--primary-soft)" : "var(--surface)",
                          color: active ? "var(--primary)" : "var(--text-muted)",
                          fontWeight: active ? 600 : 500,
                          fontSize: 12.5,
                          cursor: "pointer",
                          minHeight: 0,
                        }}
                      >
                        {s === "invoice" ? "📄 Invoice" : "🧾 Receipt"}
                      </button>
                    );
                  })}
                </div>

                {/* Language — Thai is the default */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)", marginRight: 2 }}>
                    Language
                  </span>
                  {(["th", "en"] as BillLang[]).map((l) => {
                    const active = billLang === l;
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setBillLang(l)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 999,
                          border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                          background: active ? "var(--primary-soft)" : "var(--surface)",
                          color: active ? "var(--primary)" : "var(--text-muted)",
                          fontWeight: active ? 600 : 500,
                          fontSize: 12.5,
                          cursor: "pointer",
                          minHeight: 0,
                        }}
                      >
                        {l === "th" ? "ไทย" : "English"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Step 2 · Info — date + vehicle ── */}
            <div id="pos-group-2" className="pos-step-group">
              <StepHead n={2} label="Info" />
              <div style={card}>
                {/* Date */}
                <div style={{ marginBottom: 14 }}>
                  <div style={fieldLabel}>Date</div>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value || toISODate(new Date()))}
                    style={inputL}
                  />
                </div>

                {/* Vehicle — brand → model → year + plate */}
                <div style={{ paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  <div style={fieldLabel}>Vehicle</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select
                      value={carBrandId}
                      onChange={(e) => {
                        setCarBrandId(e.target.value);
                        setCarModelId("");
                        setCarYear("");
                      }}
                      style={{ flex: "1 1 130px", ...inputS }}
                    >
                      <option value="">Brand…</option>
                      {carFitment.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={carModelId}
                      onChange={(e) => {
                        setCarModelId(e.target.value);
                        setCarYear("");
                      }}
                      disabled={!selectedBrand || brandModels.length === 0}
                      style={{ flex: "1 1 130px", ...inputS }}
                    >
                      <option value="">
                        {selectedBrand && brandModels.length === 0 ? "No models" : "Model…"}
                      </option>
                      {brandModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.yearFrom || m.yearTo
                            ? ` (${m.yearFrom ?? "…"}–${m.yearTo ?? "…"})`
                            : ""}
                        </option>
                      ))}
                    </select>
                    <select
                      value={carYear}
                      onChange={(e) => setCarYear(e.target.value)}
                      disabled={!selectedModel}
                      style={{ flex: "0 1 104px", ...inputS }}
                    >
                      <option value="">Year…</option>
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={fieldLabel}>Plate / mileage</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        value={plate}
                        onChange={(e) => setPlate(e.target.value)}
                        placeholder="License plate"
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <input
                        value={mileage}
                        onChange={(e) => setMileage(e.target.value.replace(/[^\d]/g, ""))}
                        placeholder="Mileage"
                        inputMode="numeric"
                        aria-label="Mileage (km)"
                        style={{ width: 120 }}
                      />
                      <span className="muted">km</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Step 3 · Items — add items, cart, discount ── */}
            <div id="pos-group-3" className="pos-step-group">
              <StepHead n={3} label="Items" />
              <div style={card}>
                {/* Add item — Product / Service toggle switches the workspace */}
                <div style={{ marginBottom: 14 }}>
                  <div style={fieldLabel}>Add item</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    <Seg active={addKind === "product"} onClick={() => setAddKind("product")}>
                      📦 Product
                    </Seg>
                    <Seg active={addKind === "service"} onClick={() => setAddKind("service")}>
                      🔧 Service
                    </Seg>
                    <Seg active={addKind === "addon"} onClick={() => setAddKind("addon")}>
                      ➕ Add-on
                    </Seg>
                  </div>
                  <p className="muted" style={{ fontSize: 12, margin: "0 0 12px" }}>
                    {addKind === "product"
                      ? "Scan a barcode, type the code, or search your catalog."
                      : addKind === "service"
                        ? "Pick a saved service. For a one-off, use Add-on."
                        : "A one-off item not in your catalog — type a name and price."}
                  </p>

                  {addKind === "product" && (
                    <div>
                      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                        <Tab active={method === "scan"} onClick={() => setMethod("scan")}>
                          📷 Scan barcode
                        </Tab>
                        <Tab active={method === "code"} onClick={() => setMethod("code")}>
                          ⌨️ Type code
                        </Tab>
                        <Tab active={method === "search"} onClick={() => setMethod("search")}>
                          🔍 Search
                        </Tab>
                      </div>

                      {method === "scan" && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            addByScan();
                          }}
                          style={{ display: "flex", gap: 8 }}
                        >
                          <input
                            autoFocus
                            value={scanVal}
                            onChange={(e) => setScanVal(e.target.value)}
                            placeholder="Scan or paste a barcode…"
                            style={{ flex: 1, ...inputS }}
                          />
                          <button type="submit" className="btn-soft" disabled={busy} style={inputS}>
                            Add
                          </button>
                        </form>
                      )}

                      {method === "code" && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            addByCode();
                          }}
                          style={{ display: "flex", gap: 8 }}
                        >
                          <input
                            value={codeVal}
                            onChange={(e) => setCodeVal(e.target.value)}
                            placeholder="Type a product code…"
                            style={{ flex: 1, ...inputS }}
                          />
                          <button type="submit" className="btn-soft" style={inputS}>
                            Add
                          </button>
                        </form>
                      )}

                      {method === "search" && (
                        <div style={{ position: "relative" }}>
                          <input
                            autoFocus
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                            placeholder="Search by product name or code…"
                            style={{ width: "100%", ...inputS }}
                          />
                          {searchQ.trim() && (
                            <div className="combo-pop">
                              {searchResults.length === 0 ? (
                                <p className="muted" style={{ fontSize: 13, margin: "6px 8px" }}>
                                  No product matches “{searchQ.trim()}”.
                                </p>
                              ) : (
                                searchResults.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    className="combo-opt"
                                    onClick={() => addProductLine(p)}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      gap: 8,
                                    }}
                                  >
                                    <span style={{ minWidth: 0 }}>
                                      <span
                                        style={{
                                          display: "block",
                                          fontWeight: 600,
                                          fontSize: 13,
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {p.name}
                                      </span>
                                      <span className="muted" style={{ fontSize: 12 }}>
                                        {p.productRef}
                                      </span>
                                    </span>
                                    <span
                                      style={{
                                        fontWeight: 600,
                                        fontSize: 13,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      ฿{amt(tierPrice(p))}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Service workspace */}
                  {addKind === "service" && (
                    <div>
                      <div style={fieldLabel}>Add service</div>
                      <ServiceSelect services={services} value={svcId} onSelect={selectService} />

                      {/* Add — the price is set on the item in the cart below */}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn-soft"
                          disabled={!serviceName}
                          onClick={addService}
                          style={{ ...inputS, padding: "8px 16px" }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Add-on — a one-off custom line (name + price), not from the catalog */}
                  {addKind === "addon" && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        addAddon();
                      }}
                      style={{ display: "flex", gap: 8 }}
                    >
                      <input
                        autoFocus
                        value={addonName}
                        onChange={(e) => setAddonName(e.target.value)}
                        placeholder="Item name…"
                        style={{ flex: 1, ...inputS }}
                      />
                      <input
                        value={addonPrice}
                        onChange={(e) => setAddonPrice(e.target.value)}
                        inputMode="decimal"
                        placeholder="฿ price"
                        style={{ width: 96, ...inputS }}
                      />
                      <button
                        type="submit"
                        className="btn-soft"
                        disabled={!addonName.trim()}
                        style={inputS}
                      >
                        Add
                      </button>
                    </form>
                  )}
                </div>

                {/* Cart */}
                <div
                  style={{ marginBottom: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}
                >
                  <div style={fieldLabel}>Items ({lines.length})</div>
                  {lines.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                      No items yet. Add a product or service above.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {lines.map((l) => (
                        <CartItem
                          key={l.uid}
                          line={l}
                          lang={billLang}
                          barcode={l.barcodeValue || codeToBarcode.get(l.productRef ?? "")}
                          onQty={(quantity) => updateLine(l.uid, { quantity })}
                          onPrice={(unitPriceSatang) => updateLine(l.uid, { unitPriceSatang })}
                          onTier={(t) => setLineTier(l.uid, t)}
                          onRemove={() => removeLine(l.uid)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Discount — ฿ or % off the whole bill */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    paddingTop: 14,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)", marginRight: 2 }}>
                    Discount
                  </span>
                  <input
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    style={{ flex: 1, ...inputS }}
                  />
                  {(["thb", "pct"] as DiscountKind[]).map((k) => {
                    const active = discountKind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setDiscountKind(k)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                          background: active ? "var(--primary-soft)" : "var(--surface)",
                          color: active ? "var(--primary)" : "var(--text)",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                          minHeight: 0,
                        }}
                      >
                        {k === "thb" ? "฿" : "%"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---- RIGHT: bill (preview + note + actions only) ---- */}
        {/* Frozen alongside the timeline — clears the 56px topbar (+16 gap). */}
        <div className="pos-col-right" style={{ position: "sticky", top: 72 }}>
          <div className="bill-print">
            <BillDoc
              billStyle={billStyle}
              docType={docType}
              lang={billLang}
              shop={shop}
              dateLabel={billLang === "en" ? englishDate(billDate) : thaiDate(billDate)}
              saleNumber={
                reprint ? (reprint.saleNumber ?? "") : nextSalesId(lastSaleId, Date.now())
              }
              vehicle={reprint ? reprint.vehicle : vehicleLabel}
              plate={plate.trim()}
              mileage={mileage.trim()}
              lines={lines}
              subtotalSatang={subtotalSatang}
              discountSatang={discountSatang}
              totalSatang={totalSatang}
              note={note.trim()}
            />
          </div>

          {/* Controls (not printed) — note + actions */}
          <div className="bill-no-print" style={{ marginTop: 12 }}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note to the bill…"
              rows={2}
              style={{ width: "100%", fontFamily: "inherit", marginBottom: 10 }}
            />
            {reprint ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    border: "1px solid var(--warn)",
                    color: "var(--warn)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                  }}
                >
                  🖨 Reprinting {reprint.saleNumber ?? "this bill"} — printing only, no new sale is
                  created.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn-soft"
                    onClick={() => {
                      window.location.href = "/pos";
                    }}
                    style={{ flex: 1 }}
                  >
                    Exit
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={printBill}
                    disabled={lines.length === 0}
                    style={{ flex: 1 }}
                  >
                    Create PDF
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn-soft"
                    onClick={printBill}
                    disabled={lines.length === 0}
                    style={{ flex: 1 }}
                  >
                    Create PDF
                  </button>
                  <button
                    type="button"
                    className="btn-soft"
                    onClick={saveDraftNow}
                    disabled={busy || lines.length === 0}
                    style={{ flex: 1 }}
                  >
                    Save draft
                  </button>
                </div>
                {docType === "quotation" ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={saveQuotationNow}
                    disabled={busy || lines.length === 0}
                    style={{ width: "100%" }}
                  >
                    Save quotation
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={checkout}
                    disabled={busy || lines.length === 0}
                    style={{ width: "100%" }}
                  >
                    Save File
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {draftsOpen && (
        <div
          className="bill-no-print"
          onClick={() => setDraftsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 18,
              width: "min(560px, 92vw)",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18 }}>Saved drafts &amp; quotations</h2>
              <button type="button" className="btn-soft" onClick={() => setDraftsOpen(false)}>
                Close
              </button>
            </div>
            {drafts.length === 0 ? (
              <p className="muted">No parked drafts. Save one from a cart to reopen it here.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {drafts.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <span className={`pill ${d.stage === "quotation" ? "soft" : "off"}`}>
                      {d.stage === "quotation" ? (d.saleNumber ?? "Quotation") : "Draft"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14 }}>{d.vehicle || d.licensePlate || "Walk-in"}</div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                        {formatBaht(d.grandTotalSatang)} · {d.lines.length} item(s)
                      </div>
                    </div>
                    <button type="button" className="btn-primary" onClick={() => reopenDraft(d)}>
                      Reopen
                    </button>
                    <button
                      type="button"
                      className="btn-soft"
                      onClick={() => discardDraft(d)}
                      aria-label="Delete draft"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

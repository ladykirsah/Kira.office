"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { apiBase, getProductDetail } from "@/lib/api";
import { inputS } from "@/lib/inputStyles";
import { matchesText } from "@/lib/textSearch";
import { pageDimensions, planFittedSheet, type Orientation, type Paper } from "@/lib/labelGrid";
import { PageHeader } from "../PageHeader";
import { useT } from "../LangProvider";
import {
  drawLabel,
  downloadLabelPng,
  downloadLabelSheet,
  renderSheetPreview,
  setShopName,
} from "./labelPdf";
import type { SheetLabel } from "./labelPdf";
import {
  buildLabelItem,
  fitmentLines,
  labelDimensions,
  labelFileName,
  sizeHint,
  type LabelSize,
  type LabelVersion,
} from "@/lib/labelForm";

export interface StudioProduct {
  id: string;
  /** The Product ID (product_ref). Null on a product saved before the ID became mandatory. */
  code: string | null;
  name: string;
  imageKey: string | null;
  tags: string[];
  brandName: string | null;
  usageName: string | null;
  typeName: string | null;
  carBrands: string[];
  barcode: string | null;
}

/** One product on the sheet. Version and size are fixed when it's added — a wrong row is removed. */
interface LabelItem {
  key: number;
  product: StudioProduct;
  fitment: string[];
  version: LabelVersion;
  size: LabelSize;
  w: number;
  h: number;
  amount: number;
}

/** The three words the compose form and the sheet table below it both use. */
const WORD = {
  product: { th: "สินค้า", en: "Product" },
  size: { th: "ขนาด", en: "Size" },
  amount: { th: "จำนวน", en: "Amount" },
};

const fieldLabel = { fontSize: 13, color: "var(--text-muted)", marginBottom: 4 } as const;
const hintStyle: CSSProperties = { fontSize: 12, color: "var(--text-faint)", marginTop: 4 };

/** Segmented control — S tier (32px), matching .btn-sm / inputS on the same row. */
function Seg<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        height: 32,
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            minHeight: 0,
            height: "100%",
            padding: "0 13px",
            border: "none",
            borderRadius: 0,
            fontSize: 14,
            fontWeight: value === v ? 600 : 500,
            background: value === v ? "var(--primary)" : "var(--surface)",
            color: value === v ? "#fff" : "var(--text)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Download glyph, drawn in the admin's icon style (15px, 24-grid, currentColor). */
const DownloadIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 19h16" />
  </svg>
);

function Cover({ p, size }: { p: StudioProduct; size: number }) {
  return p.imageKey ? (
    <img
      src={`${apiBase}/img/${p.imageKey}`}
      alt={p.name}
      width={size}
      height={size}
      style={{ objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
    />
  ) : (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: "var(--hover)",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-faint)",
        fontSize: size * 0.4,
      }}
    >
      📦
    </span>
  );
}

/** The real label, drawn by the print renderer and shown at `cssWidth` px. */
function LabelCanvas({
  product,
  fitment,
  version,
  size,
  cssWidth,
}: {
  product: StudioProduct;
  fitment: string[];
  version: LabelVersion;
  size: LabelSize;
  cssWidth: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const { w, h } = labelDimensions(version, size);
    drawLabel(
      canvasRef.current,
      {
        code: product.code ?? "",
        name: product.name,
        brandName: product.brandName,
        typeName: product.typeName,
        barcode: product.barcode ?? "",
        fitment,
      },
      version,
      w,
      h,
    );
  }, [product, fitment, version, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: cssWidth,
        height: "auto",
        border: "1px solid var(--border)",
        borderRadius: 6,
        background: "#fff",
      }}
    />
  );
}

export function LabelStudio({
  products,
  shopName = "",
}: {
  products: StudioProduct[];
  shopName?: string;
}) {
  const t = useT();
  // Written once because each of these sits in two places at the same time — a label and its
  // aria-label, a form field and the table column that repeats it.
  const changeProduct = t({ th: "เปลี่ยนสินค้า", en: "Change product" });
  const remove = t({ th: "ลบออก", en: "Remove" });
  /** "3 products" · "3 สินค้า" — Thai has no plural, so the "s" is an English-only detail. */
  const productCount = (n: number) =>
    t({ th: `${n} สินค้า`, en: `${n} product${n === 1 ? "" : "s"}` });
  // Apply the saved shop name to the label header before any canvas draw (effects run after this).
  setShopName(shopName);
  const [paper, setPaper] = useState<Paper>("A4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LabelItem[]>([]);
  const nextKey = useRef(1);

  // "Add a label" compose form — pick a product, choose barcode / size / amount, then Add.
  const [formProduct, setFormProduct] = useState<StudioProduct | null>(null);
  const [formFitment, setFormFitment] = useState<string[]>([]);
  const [withBarcode, setWithBarcode] = useState(true);
  const [formSize, setFormSize] = useState<LabelSize>("L");
  const [formAmount, setFormAmount] = useState("24");

  const q = query.trim();
  const results =
    open && q ? products.filter((p) => matchesText(q, p.code, p.name)).slice(0, 12) : [];

  // A product with no barcode can still get a Minimal label — that version prints no barcode.
  // With nothing picked yet the switch stays on its default (on): barcode is the normal case.
  const canUseBarcode = !formProduct || !!formProduct.barcode;
  const version: LabelVersion = withBarcode && canUseBarcode ? "full" : "minimal";

  /** Pick a product into the form, then load its fitments (brand + model + year) for the label. */
  const pickProduct = async (p: StudioProduct) => {
    setFormProduct(p);
    setFormFitment([]);
    setQuery("");
    setOpen(false);
    try {
      const detail = await getProductDetail(p.id);
      // Ignore a late answer for a product the user has already moved off.
      setFormProduct((cur) => {
        if (cur?.id === p.id) setFormFitment(fitmentLines(detail.fitments));
        return cur;
      });
    } catch {
      // The label just prints without the fitment block; adding must not be blocked by this.
    }
  };

  const addToSheet = () => {
    if (!formProduct) return;
    const built = buildLabelItem(formProduct, version, formSize, parseFloat(formAmount));
    setItems((xs) => [...xs, { key: nextKey.current++, fitment: formFitment, ...built }]);
    setFormProduct(null);
    setFormFitment([]);
  };
  const setAmount = (key: number, amount: number) =>
    setItems((xs) =>
      xs.map((it) => (it.key === key ? { ...it, amount: Math.max(1, amount) } : it)),
    );
  const removeItem = (key: number) => setItems((xs) => xs.filter((it) => it.key !== key));

  /** Save one row's label on its own, as the PNG the sheet would print. */
  const saveLabelPng = (it: LabelItem) =>
    downloadLabelPng(
      {
        code: it.product.code ?? "",
        name: it.product.name,
        brandName: it.product.brandName,
        typeName: it.product.typeName,
        barcode: it.product.barcode ?? "",
        fitment: it.fitment,
      },
      it.version,
      it.w,
      it.h,
      labelFileName(it.product.code, it.version, it.size),
    );

  const labels: SheetLabel[] = items.map((it) => ({
    code: it.product.code ?? "",
    name: it.product.name,
    brandName: it.product.brandName,
    typeName: it.product.typeName,
    barcode: it.product.barcode ?? "",
    fitment: it.fitment,
    version: it.version,
    w: it.w,
    h: it.h,
    amount: it.amount,
  }));

  const plan = planFittedSheet({
    items: labels.map((it) => ({ w: it.w, h: it.h, amount: it.amount })),
    page: pageDimensions(paper, orientation),
  });
  const totalLabels = items.reduce((n, it) => n + it.amount, 0);

  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (previewRef.current)
      renderSheetPreview(previewRef.current, { paper, orientation, items: labels });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, paper, orientation]);

  const download = () => downloadLabelSheet({ paper, orientation, items: labels });

  return (
    <main>
      <PageHeader
        title={t({ th: "ป้ายบาร์โค้ด", en: "Barcode labels" })}
        subtitle={t({
          th: "เพิ่มป้ายให้แต่ละสินค้า แล้วดาวน์โหลดเป็น PDF ไฟล์เดียว",
          en: "Add a label for each product, then download one PDF with all of them.",
        })}
      />

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div
          style={{
            flex: "1 1 560px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* ── Add a label ─────────────────────────────────────── */}
          <section
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 18,
              background: "var(--surface)",
            }}
          >
            <div style={{ fontWeight: 600 }}>{t({ th: "เพิ่มป้าย", en: "Add a label" })}</div>

            {/* Product */}
            <div style={{ marginTop: 14, maxWidth: 430 }}>
              <span style={{ ...fieldLabel, display: "block" }}>{t(WORD.product)}</span>
              {formProduct ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 10px",
                    border: "1px solid var(--primary-soft)",
                    background: "var(--primary-faint)",
                    borderRadius: 10,
                  }}
                >
                  <Cover p={formProduct} size={34} />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        display: "block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {formProduct.name}
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {formProduct.code}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={changeProduct}
                    title={changeProduct}
                    onClick={() => {
                      setFormProduct(null);
                      setFormFitment([]);
                    }}
                    className="icon-btn"
                    style={{ marginLeft: "auto", color: "var(--danger)" }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <input
                    className="tbar-input"
                    placeholder={t({
                      th: "ค้นหาสินค้า…  (รหัสหรือชื่อ)",
                      en: "Search a product…  (code or name)",
                    })}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    style={{ width: "100%", color: "var(--text)", fontWeight: 500 }}
                  />
                  {results.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        zIndex: 5,
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                        overflow: "hidden",
                        maxHeight: 360,
                        overflowY: "auto",
                      }}
                    >
                      {results.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => void pickProduct(p)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            width: "100%",
                            minHeight: 0,
                            padding: "8px 12px",
                            border: "none",
                            borderRadius: 0,
                            background: "transparent",
                            textAlign: "left",
                          }}
                        >
                          <Cover p={p} size={32} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ fontWeight: 600, display: "block" }}>{p.name}</span>
                            <span className="muted" style={{ fontSize: 12 }}>
                              {p.code}
                              {p.barcode ? "" : " · no barcode"}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Barcode · size · amount */}
            <div
              style={{
                display: "flex",
                gap: 22,
                alignItems: "flex-start",
                flexWrap: "wrap",
                marginTop: 16,
              }}
            >
              <div>
                <span style={{ ...fieldLabel, display: "block" }}>
                  {t({ th: "บาร์โค้ด", en: "Barcode" })}
                </span>
                <label
                  style={{
                    display: "flex",
                    gap: 9,
                    alignItems: "center",
                    height: 32,
                    cursor: canUseBarcode ? "pointer" : "not-allowed",
                  }}
                >
                  <span className="switch">
                    <input
                      type="checkbox"
                      checked={version === "full"}
                      disabled={!canUseBarcode}
                      onChange={(e) => setWithBarcode(e.target.checked)}
                    />
                    <span className="slider" />
                  </span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {version === "full"
                      ? t({ th: "ป้ายเต็ม", en: "Full label" })
                      : t({ th: "ป้ายย่อ", en: "Minimal label" })}
                  </span>
                </label>
                <div style={hintStyle}>
                  {!canUseBarcode && formProduct
                    ? t({ th: "สินค้านี้ไม่มีบาร์โค้ด", en: "No barcode on this product" })
                    : version === "full"
                      ? t({ th: "บาร์โค้ด + รหัส + ชื่อร้าน", en: "Barcode + ID + shop name" })
                      : t({ th: "ชื่อ + รุ่นรถที่ใช้ได้ เท่านั้น", en: "Name + fitment only" })}
                </div>
              </div>

              <div>
                <span style={{ ...fieldLabel, display: "block" }}>{t(WORD.size)}</span>
                <Seg
                  value={formSize}
                  onChange={setFormSize}
                  options={[
                    ["L", "L"],
                    ["S", "S"],
                  ]}
                />
                <div style={hintStyle}>{t(sizeHint(formSize))}</div>
              </div>

              <div>
                <span style={{ ...fieldLabel, display: "block" }}>{t(WORD.amount)}</span>
                <input
                  type="number"
                  min={1}
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  style={{ ...inputS, width: 76, textAlign: "center", fontWeight: 600 }}
                />
              </div>
            </div>

            {/* Preview · add */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                borderTop: "1px solid var(--border)",
                marginTop: 16,
                paddingTop: 16,
              }}
            >
              <div>
                <span style={{ ...fieldLabel, display: "block" }}>
                  {t({ th: "ตัวอย่าง", en: "Preview" })}
                </span>
                {formProduct ? (
                  <LabelCanvas
                    product={formProduct}
                    fitment={formFitment}
                    version={version}
                    size={formSize}
                    cssWidth={250}
                  />
                ) : (
                  <div
                    style={{
                      border: "1px dashed var(--border)",
                      borderRadius: 10,
                      padding: "16px 18px",
                      color: "var(--text-faint)",
                      fontSize: 13,
                    }}
                  >
                    {t({
                      th: "เลือกสินค้าเพื่อดูตัวอย่างป้าย",
                      en: "Pick a product to preview the label.",
                    })}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={!formProduct}
                onClick={addToSheet}
              >
                {t({ th: "เพิ่มลงแผ่น", en: "Add to sheet" })}
              </button>
            </div>
          </section>

          {/* ── On the sheet ────────────────────────────────────── */}
          <section
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 18,
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 600 }}>{t({ th: "บนแผ่น", en: "On the sheet" })}</span>
              {items.length > 0 && <span className="pill soft">{productCount(items.length)}</span>}
            </div>

            {items.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>
                {t({
                  th: "ยังไม่มีป้าย — เพิ่มด้านบนเพื่อเริ่มแผ่นนี้",
                  en: "No labels yet — add one above to start the sheet.",
                })}
              </p>
            ) : (
              <div style={{ marginTop: 12, overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 112 }}>{t({ th: "ป้าย", en: "Label" })}</th>
                      <th style={{ width: "44%" }}>{t(WORD.product)}</th>
                      <th>{t(WORD.size)}</th>
                      <th>{t(WORD.amount)}</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.key}>
                        <td>
                          <LabelCanvas
                            product={it.product}
                            fitment={it.fitment}
                            version={it.version}
                            size={it.size}
                            cssWidth={90}
                          />
                        </td>
                        <td>
                          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Cover p={it.product} size={32} />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ fontWeight: 600, display: "block" }}>
                                {it.product.name}
                              </span>
                              <span className="muted" style={{ fontSize: 12 }}>
                                {it.product.code}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{it.size}</td>
                        <td>
                          <span
                            style={{
                              display: "inline-flex",
                              height: 32,
                              border: "1px solid var(--border)",
                              borderRadius: 10,
                              overflow: "hidden",
                            }}
                          >
                            <button
                              type="button"
                              aria-label={t({ th: "ลดหนึ่ง", en: "One fewer" })}
                              onClick={() => setAmount(it.key, it.amount - 1)}
                              style={{
                                minHeight: 0,
                                width: 30,
                                padding: 0,
                                border: "none",
                                borderRadius: 0,
                                color: "var(--text-muted)",
                              }}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={it.amount}
                              onChange={(e) =>
                                setAmount(it.key, Math.round(parseFloat(e.target.value) || 1))
                              }
                              aria-label={t(WORD.amount)}
                              style={{
                                minHeight: 0,
                                width: 52,
                                padding: 0,
                                textAlign: "center",
                                fontWeight: 600,
                                border: "none",
                                borderLeft: "1px solid var(--border)",
                                borderRight: "1px solid var(--border)",
                                borderRadius: 0,
                              }}
                            />
                            <button
                              type="button"
                              aria-label={t({ th: "เพิ่มหนึ่ง", en: "One more" })}
                              onClick={() => setAmount(it.key, it.amount + 1)}
                              style={{
                                minHeight: 0,
                                width: 30,
                                padding: 0,
                                border: "none",
                                borderRadius: 0,
                                color: "var(--text-muted)",
                              }}
                            >
                              +
                            </button>
                          </span>
                        </td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                            <button
                              type="button"
                              aria-label={t({
                                th: `บันทึกป้าย ${it.product.name} เป็น PNG`,
                                en: `Save ${it.product.name} label as PNG`,
                              })}
                              title={t({
                                th: "บันทึกป้ายนี้เป็น PNG",
                                en: "Save this label as a PNG",
                              })}
                              onClick={() => saveLabelPng(it)}
                              className="icon-btn"
                            >
                              <DownloadIcon />
                            </button>
                            <button
                              type="button"
                              aria-label={remove}
                              title={remove}
                              onClick={() => removeItem(it.key)}
                              className="icon-btn"
                              style={{ color: "var(--danger)" }}
                            >
                              ✕
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 12,
                    fontSize: 13,
                    color: "var(--text-muted)",
                    borderTop: "2px solid var(--border)",
                  }}
                >
                  <span>{productCount(items.length)}</span>
                  {/* The count stays bold in both languages; the words around it swap sides,
                      which is why one half of each pair is deliberately empty. */}
                  <span>
                    {t({ th: "รวม ", en: "" })}
                    <b style={{ color: "var(--text)" }}>
                      {totalLabels} {t({ th: "ป้าย", en: "labels" })}
                    </b>
                    {t({ th: "", en: " in total" })}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ── Your sheet ────────────────────────────────────────── */}
        {items.length > 0 && (
          <section
            style={{
              flex: "1 1 372px",
              minWidth: 300,
              maxWidth: 520,
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 18,
              background: "var(--surface)",
              position: "sticky",
              top: 16,
            }}
          >
            <div style={{ fontWeight: 600 }}>{t({ th: "แผ่นของคุณ", en: "Your sheet" })}</div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16 }}>
              <div>
                <div style={fieldLabel}>{t({ th: "กระดาษ", en: "Paper" })}</div>
                <Seg
                  value={paper}
                  onChange={setPaper}
                  options={[
                    ["A4", "A4"],
                    ["A5", "A5"],
                  ]}
                />
              </div>
              <div>
                <div style={fieldLabel}>{t({ th: "การวางแนว", en: "Orientation" })}</div>
                <Seg
                  value={orientation}
                  onChange={setOrientation}
                  options={[
                    ["portrait", t({ th: "แนวตั้ง", en: "Portrait" })],
                    ["landscape", t({ th: "แนวนอน", en: "Landscape" })],
                  ]}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                margin: "16px 0",
              }}
            >
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={plan.placements.length === 0}
                onClick={download}
              >
                {t({ th: "ดาวน์โหลด PDF", en: "Download PDF" })}
              </button>
              <span className="muted" style={{ fontSize: 13 }}>
                {t({
                  th: `${plan.placements.length} ป้าย · ${plan.pages} หน้า ${paper}`,
                  en: `${plan.placements.length} label${plan.placements.length === 1 ? "" : "s"} · ${plan.pages} ${paper} page${plan.pages === 1 ? "" : "s"}`,
                })}
              </span>
            </div>

            {plan.placements.length > 0 && (
              <div>
                <div style={fieldLabel}>{t({ th: "ตัวอย่างไฟล์", en: "File preview" })}</div>
                <div ref={previewRef} className="sheet-preview" />
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

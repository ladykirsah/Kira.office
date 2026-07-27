"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { apiBase, getProductDetail } from "@/lib/api";
import { inputS } from "@/lib/inputStyles";
import { pageDimensions, planSheet, type Orientation, type Paper } from "@/lib/labelGrid";
import { PageHeader } from "../PageHeader";
import { drawLabel, downloadLabelSheet, renderSheetPreview, setShopName } from "./labelPdf";
import type { SheetLabel } from "./labelPdf";
import {
  buildLabelItem,
  fitmentLines,
  labelDimensions,
  sizeHint,
  type LabelSize,
  type LabelVersion,
} from "@/lib/labelForm";

export interface StudioProduct {
  id: string;
  code: string;
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
        code: product.code,
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

  const q = query.trim().toLowerCase();
  const results =
    open && q
      ? products
          .filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
          .slice(0, 12)
      : [];

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

  const labels: SheetLabel[] = items.map((it) => ({
    code: it.product.code,
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

  const plan = planSheet({
    items: labels.map((it) => ({ w: it.w, h: it.h, amount: it.amount })),
    page: pageDimensions(paper, orientation),
    margin: 8,
    gap: 0,
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
        title="Barcode labels"
        subtitle="Add a label for each product, then download one PDF with all of them."
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
            <div style={{ fontWeight: 600 }}>Add a label</div>

            {/* Product */}
            <div style={{ marginTop: 14, maxWidth: 430 }}>
              <span style={{ ...fieldLabel, display: "block" }}>Product</span>
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
                    aria-label="Change product"
                    title="Change product"
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
                    placeholder="Search a product…  (code or name)"
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
                <span style={{ ...fieldLabel, display: "block" }}>Barcode</span>
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
                    {version === "full" ? "Full label" : "Minimal label"}
                  </span>
                </label>
                <div style={hintStyle}>
                  {!canUseBarcode && formProduct
                    ? "No barcode on this product"
                    : version === "full"
                      ? "Barcode + ID + shop name"
                      : "Name + fitment only"}
                </div>
              </div>

              <div>
                <span style={{ ...fieldLabel, display: "block" }}>Size</span>
                <Seg
                  value={formSize}
                  onChange={setFormSize}
                  options={[
                    ["L", "L"],
                    ["S", "S"],
                  ]}
                />
                <div style={hintStyle}>{sizeHint(formSize)}</div>
              </div>

              <div>
                <span style={{ ...fieldLabel, display: "block" }}>Amount</span>
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
                <span style={{ ...fieldLabel, display: "block" }}>Preview</span>
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
                    Pick a product to preview the label.
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={!formProduct}
                onClick={addToSheet}
              >
                Add to sheet
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
              <span style={{ fontWeight: 600 }}>On the sheet</span>
              {items.length > 0 && (
                <span className="pill soft">
                  {items.length} product{items.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>
                No labels yet — add one above to start the sheet.
              </p>
            ) : (
              <div style={{ marginTop: 12, overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 112 }}>Label</th>
                      <th style={{ width: "44%" }}>Product</th>
                      <th>Size</th>
                      <th>Amount</th>
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
                              aria-label="One fewer"
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
                              aria-label="Amount"
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
                              aria-label="One more"
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
                          <button
                            type="button"
                            aria-label="Remove"
                            title="Remove"
                            onClick={() => removeItem(it.key)}
                            className="icon-btn"
                            style={{ color: "var(--danger)" }}
                          >
                            ✕
                          </button>
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
                  <span>
                    {items.length} product{items.length === 1 ? "" : "s"}
                  </span>
                  <span>
                    <b style={{ color: "var(--text)" }}>{totalLabels} labels</b> in total
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
              flex: "0 1 372px",
              minWidth: 300,
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 18,
              background: "var(--surface)",
              position: "sticky",
              top: 16,
            }}
          >
            <div style={{ fontWeight: 600 }}>Your sheet</div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16 }}>
              <div>
                <div style={fieldLabel}>Paper</div>
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
                <div style={fieldLabel}>Orientation</div>
                <Seg
                  value={orientation}
                  onChange={setOrientation}
                  options={[
                    ["portrait", "Portrait"],
                    ["landscape", "Landscape"],
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
                Download PDF
              </button>
              <span className="muted" style={{ fontSize: 13 }}>
                {plan.placements.length} label{plan.placements.length === 1 ? "" : "s"} ·{" "}
                {plan.pages} {paper} page{plan.pages === 1 ? "" : "s"}
              </span>
            </div>

            {plan.placements.length > 0 && (
              <div>
                <div style={fieldLabel}>File preview</div>
                <div ref={previewRef} className="sheet-preview" />
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

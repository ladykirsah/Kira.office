"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { apiBase } from "@/lib/api";
import { pageDimensions, planSheet, type Orientation, type Paper } from "@/lib/labelGrid";
import { drawLabel, downloadLabelSheet, renderSheetPreview, type SheetLabel } from "./labelPdf";

export interface StudioProduct {
  id: string;
  code: string;
  name: string;
  imageKey: string | null;
  tags: string[];
  barcode: string | null;
}

interface LabelItem {
  product: StudioProduct;
  w: number;
  h: number;
  amount: number;
  showBarcode: boolean;
}

const RATIO = 50 / 30; // locked label aspect ratio
const fieldLabel = { fontSize: 13, color: "var(--text-muted)", marginBottom: 4 } as const;

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
        border: "1px solid var(--border)",
        borderRadius: 8,
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
            padding: "7px 16px",
            border: "none",
            borderRadius: 0,
            fontWeight: value === v ? 600 : 400,
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
    // eslint-disable-next-line @next/next/no-img-element
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

const numStyle: CSSProperties = { width: 76, minHeight: 0, padding: "8px 10px" };

function Field({
  label,
  suffix,
  children,
}: {
  label: string;
  suffix?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 30, fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
      {children}
      {suffix ? <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{suffix}</span> : null}
    </div>
  );
}

/** One product's label settings + live preview, inside the sheet builder. */
function LabelCard({
  item,
  onChange,
  onRemove,
}: {
  item: LabelItem;
  onChange: (patch: Partial<LabelItem>) => void;
  onRemove: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { product, w, h, amount, showBarcode } = item;

  useEffect(() => {
    if (canvasRef.current && product.barcode) {
      drawLabel(
        canvasRef.current,
        { code: product.code, name: product.name, tags: product.tags, barcode: product.barcode },
        w,
        h,
        showBarcode,
      );
    }
  }, [product.id, product.barcode, product.code, product.name, product.tags, w, h, showBarcode]);

  const changeW = (v: number) => {
    if (Number.isFinite(v) && v > 0) onChange({ w: v, h: Math.max(1, Math.round(v / RATIO)) });
  };
  const changeH = (v: number) => {
    if (Number.isFinite(v) && v > 0) onChange({ h: v, w: Math.max(1, Math.round(v * RATIO)) });
  };

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        background: "var(--surface)",
      }}
    >
      {/* Selected product */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Cover p={product} size={48} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {product.name}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {product.code}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
            {product.tags.filter(Boolean).map((t) => (
              <span key={t} className="tag tag-sm">
                {t}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          aria-label="Remove"
          title="Remove"
          onClick={onRemove}
          className="icon-btn"
          style={{ color: "var(--danger)", alignSelf: "flex-start" }}
        >
          ✕
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", margin: "14px 0" }} />

      {/* Size & quantity (left) · label preview (right) */}
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="W" suffix="mm">
            <input
              type="number"
              min={10}
              value={w}
              onChange={(e) => changeW(parseFloat(e.target.value))}
              style={numStyle}
            />
          </Field>
          <Field label="H" suffix="mm">
            <input
              type="number"
              min={6}
              value={h}
              onChange={(e) => changeH(parseFloat(e.target.value))}
              style={numStyle}
            />
          </Field>
          <Field label="Qty">
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) =>
                onChange({ amount: Math.max(1, Math.round(parseFloat(e.target.value) || 1)) })
              }
              style={numStyle}
            />
          </Field>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <span className="switch">
              <input
                type="checkbox"
                checked={showBarcode}
                onChange={(e) => onChange({ showBarcode: e.target.checked })}
              />
              <span className="slider" />
            </span>
            <span style={{ fontSize: 13 }}>Barcode &amp; code</span>
          </label>
          <canvas
            ref={canvasRef}
            style={{
              width: 160,
              height: "auto",
              border: "1px solid var(--border)",
              borderRadius: 6,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function LabelStudio({ products }: { products: StudioProduct[] }) {
  const [paper, setPaper] = useState<Paper>("A4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LabelItem[]>([]);

  const q = query.trim().toLowerCase();
  const chosen = new Set(items.map((it) => it.product.id));
  const results = q
    ? products
        .filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
        .slice(0, 8)
    : [];

  const addProduct = (p: StudioProduct) => {
    if (!p.barcode || chosen.has(p.id)) return;
    setItems((xs) => [...xs, { product: p, w: 50, h: 30, amount: 24, showBarcode: true }]);
    setQuery("");
  };
  const patchItem = (id: string, patch: Partial<LabelItem>) =>
    setItems((xs) => xs.map((it) => (it.product.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => setItems((xs) => xs.filter((it) => it.product.id !== id));

  const labels: SheetLabel[] = items
    .filter((it) => it.product.barcode)
    .map((it) => ({
      code: it.product.code,
      name: it.product.name,
      tags: it.product.tags,
      barcode: it.product.barcode as string,
      w: it.w,
      h: it.h,
      amount: it.amount,
      showBarcode: it.showBarcode,
    }));

  const plan = planSheet({
    items: labels.map((it) => ({ w: it.w, h: it.h, amount: it.amount })),
    page: pageDimensions(paper, orientation),
    margin: 8,
    gap: 4,
  });

  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (previewRef.current)
      renderSheetPreview(previewRef.current, { paper, orientation, items: labels });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, paper, orientation]);

  const download = () => downloadLabelSheet({ paper, orientation, items: labels });

  return (
    <main>
      <h1>Barcode labels</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Add the products you need, set each label’s size and quantity, then download one PDF with
        all of them.
      </p>

      <div
        style={{
          display: "flex",
          gap: 28,
          flexWrap: "wrap",
          alignItems: "flex-start",
          marginTop: 16,
        }}
      >
        {/* Column 1 — search + product label cards */}
        <div
          style={{
            flex: "1 1 360px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ position: "relative", maxWidth: 420 }}>
            <input
              className="tbar-input"
              placeholder="Search a product to add…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
                }}
              >
                {results.map((p) => {
                  const added = chosen.has(p.id);
                  const disabled = !p.barcode || added;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => addProduct(p)}
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
                        opacity: disabled ? 0.5 : 1,
                      }}
                    >
                      <Cover p={p} size={32} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600, display: "block" }}>{p.name}</span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {p.code}
                          {!p.barcode ? " · no barcode" : added ? " · added" : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <p className="muted">No products yet — search above to add labels to the sheet.</p>
          ) : (
            items.map((it) => (
              <LabelCard
                key={it.product.id}
                item={it}
                onChange={(patch) => patchItem(it.product.id, patch)}
                onRemove={() => removeItem(it.product.id)}
              />
            ))
          )}
        </div>

        {/* Column 2 — paper, download, file preview (stays in view) */}
        <div
          style={{
            flex: "1 1 360px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            position: "sticky",
            top: 16,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={fieldLabel}>Paper size</div>
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

          {items.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-primary"
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
          )}

          {plan.placements.length > 0 && (
            <div>
              <div style={fieldLabel}>File preview</div>
              <div ref={previewRef} className="sheet-preview" />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

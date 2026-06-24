"use client";

import { useEffect, useRef, useState } from "react";
import { apiBase } from "@/lib/api";
import { pageDimensions, planLabelGrid, type Orientation, type Paper } from "@/lib/labelGrid";
import { drawLabel, downloadLabelPdf, type LabelProduct } from "./labelPdf";

export interface StudioProduct {
  id: string;
  code: string;
  name: string;
  imageKey: string | null;
  tags: string[];
  barcode: string | null;
}

const RATIO = 50 / 30; // locked label aspect ratio

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

function Tags({ tags }: { tags: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
      {tags.filter(Boolean).map((t) => (
        <span key={t} className="tag tag-sm">
          {t}
        </span>
      ))}
    </div>
  );
}

export function LabelStudio({ products }: { products: StudioProduct[] }) {
  const [paper, setPaper] = useState<Paper>("A4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StudioProduct | null>(null);
  const [w, setW] = useState(50);
  const [h, setH] = useState(30);
  const [amount, setAmount] = useState(24);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const q = query.trim().toLowerCase();
  const results = q
    ? products
        .filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
        .slice(0, 8)
    : [];

  const label: LabelProduct | null =
    selected && selected.barcode
      ? { code: selected.code, name: selected.name, tags: selected.tags, barcode: selected.barcode }
      : null;

  useEffect(() => {
    if (canvasRef.current && label) drawLabel(canvasRef.current, label, w, h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.barcode, w, h]);

  const changeW = (v: number) => {
    if (!Number.isFinite(v) || v <= 0) return;
    setW(v);
    setH(Math.max(1, Math.round(v / RATIO)));
  };
  const changeH = (v: number) => {
    if (!Number.isFinite(v) || v <= 0) return;
    setH(v);
    setW(Math.max(1, Math.round(v * RATIO)));
  };

  const grid = planLabelGrid({
    page: pageDimensions(paper, orientation),
    labelW: w,
    labelH: h,
    margin: 8,
    gap: 4,
  });
  const pages = grid.perPage > 0 ? Math.ceil(amount / grid.perPage) : 0;

  const cover = (p: StudioProduct, size: number) =>
    p.imageKey ? (
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

  const fieldLabel = { fontSize: 13, color: "var(--text-muted)", marginBottom: 4 } as const;

  return (
    <main>
      <h1>Barcode labels</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Search a product, set the label size and how many, then download a print-ready PDF.
      </p>

      {/* Paper + orientation */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, margin: "16px 0" }}>
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

      {/* Search */}
      <div style={{ position: "relative", maxWidth: 420 }}>
        <input
          className="tbar-input"
          placeholder="Search code or name…"
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
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelected(p);
                  setQuery("");
                }}
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
                {cover(p, 32)}
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

      {/* Chosen product + label studio */}
      {selected && (
        <div
          style={{
            marginTop: 20,
            display: "flex",
            flexWrap: "wrap",
            gap: 28,
            alignItems: "flex-start",
          }}
        >
          {/* Chosen card */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              background: "var(--surface)",
              display: "flex",
              gap: 14,
              alignItems: "center",
              minWidth: 280,
            }}
          >
            {cover(selected, 72)}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{selected.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {selected.code}
              </div>
              <Tags tags={selected.tags} />
            </div>
          </div>

          {/* Label preview + controls */}
          {label ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={fieldLabel}>Barcode preview (1 frame)</div>
                <canvas
                  ref={canvasRef}
                  style={{
                    width: Math.min(w * 4, 360),
                    height: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <div style={fieldLabel}>Width (mm)</div>
                  <input
                    type="number"
                    value={w}
                    min={10}
                    onChange={(e) => changeW(parseFloat(e.target.value))}
                    style={{ width: 90, minHeight: 0, padding: "8px 10px" }}
                  />
                </div>
                <div style={{ paddingBottom: 9, color: "var(--text-faint)" }}>×</div>
                <div>
                  <div style={fieldLabel}>Height (mm)</div>
                  <input
                    type="number"
                    value={h}
                    min={6}
                    onChange={(e) => changeH(parseFloat(e.target.value))}
                    style={{ width: 90, minHeight: 0, padding: "8px 10px" }}
                  />
                </div>
                <div>
                  <div style={fieldLabel}>Amount</div>
                  <input
                    type="number"
                    value={amount}
                    min={1}
                    onChange={(e) =>
                      setAmount(Math.max(1, Math.round(parseFloat(e.target.value) || 1)))
                    }
                    style={{ width: 90, minHeight: 0, padding: "8px 10px" }}
                  />
                </div>
              </div>

              <div className="muted" style={{ fontSize: 13 }}>
                {grid.perPage > 0
                  ? `${grid.cols} × ${grid.rows} = ${grid.perPage} per ${paper} page · ${pages} page${pages === 1 ? "" : "s"}`
                  : "Label is too big for this page — reduce the size."}
              </div>

              <div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={grid.perPage < 1}
                  onClick={() =>
                    downloadLabelPdf({
                      paper,
                      orientation,
                      labelW: w,
                      labelH: h,
                      amount,
                      product: label,
                    })
                  }
                >
                  Download PDF
                </button>
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--warn)" }}>
              This product has no barcode yet — add one in the product editor first.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

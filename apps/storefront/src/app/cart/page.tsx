"use client";

import Link from "next/link";
import { useState } from "react";
import { cartTotalSatang, removeLine, setQty, useCart } from "@/lib/cart";
import { BrandTag } from "@/components/BrandTag";
import { baht } from "@/lib/format";
import { imgUrl } from "@/lib/img";

/**
 * Cart — client-only (localStorage cart), one card of line rows + a sticky total bar.
 * Prices here are display-only; the checkout API re-prices everything server-side.
 */

const clamp2: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/** 72px product thumb; local-dev image keys often 404 → graceful Thai placeholder, never broken. */
function Thumb({ imageKey, alt }: { imageKey: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!imageKey || failed) {
    return (
      <div className="frame" style={{ width: 72, height: 72, flexShrink: 0 }}>
        <span aria-hidden="true" style={{ fontSize: 44, lineHeight: 1, color: "var(--brand)" }}>
          ✦
        </span>
      </div>
    );
  }
  return (
    <div className="frame" style={{ width: 72, height: 72, flexShrink: 0 }}>
      <img src={imgUrl(imageKey)} alt={alt} onError={() => setFailed(true)} />
    </div>
  );
}

const stepBtnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  border: "none",
  background: "transparent",
  borderRadius: 999,
  fontSize: 18,
  lineHeight: 1,
  color: "var(--text)",
};

export default function CartPage() {
  const lines = useCart();

  if (lines.length === 0) {
    return (
      <div className="section">
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>ตะกร้ายังว่างอยู่</p>
          <Link href="/products" className="btn btn-primary">
            เลือกซื้อสินค้า
          </Link>
        </div>
      </div>
    );
  }

  const total = cartTotalSatang(lines);

  return (
    <div className="has-sticky-bar">
      <div className="card">
        {lines.map((l, i) => (
          <div
            key={l.variantId}
            style={{
              display: "flex",
              gap: 12,
              padding: 14,
              alignItems: "flex-start",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
            }}
          >
            <Thumb imageKey={l.imageKey} alt={l.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-dark)", ...clamp2 }}>
                {l.name}
              </div>
              <div style={{ margin: "4px 0 10px", minHeight: 17 }}>
                {l.brandName && <BrandTag name={l.brandName} />}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <div className="t-price-m">{baht(l.priceSatang * l.qty)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                    }}
                  >
                    <button
                      type="button"
                      aria-label={`ลดจำนวน ${l.name}`}
                      style={stepBtnStyle}
                      onClick={() => setQty(l.variantId, l.qty - 1)}
                    >
                      −
                    </button>
                    <span
                      style={{ minWidth: 26, textAlign: "center", fontSize: 14, fontWeight: 600 }}
                    >
                      {l.qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`เพิ่มจำนวน ${l.name}`}
                      style={stepBtnStyle}
                      onClick={() => setQty(l.variantId, Math.min(99, l.qty + 1))}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`ลบ ${l.name} ออกจากตะกร้า`}
                    onClick={() => removeLine(l.variantId)}
                    style={{
                      width: 36,
                      height: 36,
                      border: "none",
                      background: "transparent",
                      borderRadius: 999,
                      color: "var(--text-muted)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13a2 2 0 0 1-2 1.8H9A2 2 0 0 1 7 20L6 7"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky-bar">
        <div className="sticky-bar-inner">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--gray-mid)", fontWeight: 500 }}>
              รวม {lines.length} รายการ
            </div>
            <div className="t-price-l">{baht(total)}</div>
          </div>
          <Link href="/checkout" className="btn btn-primary">
            ไปหน้าชำระเงิน →
          </Link>
        </div>
      </div>
    </div>
  );
}

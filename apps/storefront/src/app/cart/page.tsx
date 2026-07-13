"use client";

import Link from "next/link";
import { useState } from "react";
import { cartTotalSatang, removeLine, setQty, useCart } from "@/lib/cart";
import { BrandTag } from "@/components/BrandTag";
import { Icon } from "@/components/Icon";
import { ReadyToShip } from "@/components/ReadyToShip";
import { baht } from "@/lib/format";
import { imgUrl } from "@/lib/img";

/**
 * Cart — client-only (localStorage cart), one card per line item + a sticky total bar.
 * Prices here are display-only; the checkout API re-prices everything server-side.
 */

/** One-line product name (compact cart card). */
const nameStyle: React.CSSProperties = {
  fontSize: 13.5,
  fontWeight: 700,
  color: "var(--gray-dark)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/** Square product thumb that fills the card's inner height, with the card's padding as an even gap
 *  around it (like the flash card). Local-dev image keys often 404 → graceful ✦ placeholder. */
function Thumb({ imageKey, alt }: { imageKey: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const style: React.CSSProperties = { width: 88, height: 88, flexShrink: 0 };
  if (!imageKey || failed) {
    return (
      <div className="frame" style={style}>
        <span aria-hidden="true" style={{ fontSize: 40, lineHeight: 1, color: "var(--brand)" }}>
          ✦
        </span>
      </div>
    );
  }
  return (
    <div className="frame" style={style}>
      <img src={imgUrl(imageKey)} alt={alt} onError={() => setFailed(true)} />
    </div>
  );
}

const stepBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "none",
  background: "transparent",
  borderRadius: 999,
  fontSize: 16,
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
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lines.map((l) => (
          <div
            key={l.variantId}
            className="card"
            style={{ display: "flex", alignItems: "stretch", gap: 11, padding: 10 }}
          >
            <Thumb imageKey={l.imageKey} alt={l.name} />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <div style={nameStyle}>{l.name}</div>
              {/* product detail (brand) + status (ready-to-ship) — the shared default info pills:
                  GRAY = detail via BrandTag, GREEN = status via ReadyToShip. */}
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                {l.brandName && <BrandTag name={l.brandName} />}
                <ReadyToShip />
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
                      style={{ minWidth: 20, textAlign: "center", fontSize: 12, fontWeight: 600 }}
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
                    <Icon name="trash" size={18} />
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

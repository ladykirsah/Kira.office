"use client";

import Link from "next/link";
import { useState } from "react";
import { removeLine, setQty, useCart, type CartLine } from "@/lib/cart";
import { cartTitle, cartTotals, minusStep, plusStep, MAX_QTY } from "@/lib/cartPage";
import { baht } from "@/lib/format";
import { imgUrl } from "@/lib/img";
import { Icon } from "@/components/Icon";
import { SizeTag } from "@/components/SizeTag";
import { SubHeader } from "@/components/home/SubHeader";

/**
 * Phone cart = board 4 · 4.1–4.3 (drawn 5 Nov 2026, Apple text 14 Nov; owner: "Yes, build board 4").
 * One white card of lines (photo, name 2 lines, price, 🗑, − n +), the total bar with ชำระเงิน, the
 * ลบ / ยกเลิก sheet, and the empty cart. Computers keep today's cart.
 */
export function CartPhone() {
  const lines = useCart();
  const [asking, setAsking] = useState<CartLine | null>(null);

  if (lines.length === 0) return <EmptyCart title={cartTitle(lines)} />;

  const totals = cartTotals(lines);
  return (
    <div className="cart-phone">
      <SubHeader title={cartTitle(lines)} tools={false} />
      <ul className="cp-card">
        {lines.map((l) => (
          <CartRow key={l.variantId} line={l} onAskRemove={() => setAsking(l)} />
        ))}
      </ul>

      <div className="cp-bar">
        <div className="cp-bar-sum">
          <span className="cp-bar-count">{totals.countLine}</span>
          <span className="cp-bar-total">{totals.total}</span>
          <span className="cp-bar-note">{totals.note}</span>
        </div>
        <Link href="/checkout" className="cp-btn-red cp-bar-btn">
          ชำระเงิน
        </Link>
      </div>

      {asking && (
        <div className="hm-sheet-wrap" role="dialog" aria-modal="true" aria-label="ลบออกจากตะกร้า?">
          <button
            type="button"
            className="hm-dim"
            aria-label="ยกเลิก"
            onClick={() => setAsking(null)}
          />
          <div className="hm-sheet cp-ask">
            <p className="cp-ask-t">ลบออกจากตะกร้า?</p>
            <button
              type="button"
              className="cp-btn-red"
              onClick={() => {
                removeLine(asking.variantId);
                setAsking(null);
              }}
            >
              ลบ
            </button>
            <button type="button" className="cp-btn-grey" onClick={() => setAsking(null)}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CartRow({ line, onAskRemove }: { line: CartLine; onAskRemove: () => void }) {
  const [failed, setFailed] = useState(false);
  const minus = () => {
    const next = minusStep(line.qty);
    if (next === "ask-remove") onAskRemove();
    else setQty(line.variantId, next);
  };
  return (
    <li className="cp-row">
      {line.imageKey && !failed ? (
        <img
          className="cp-photo"
          src={imgUrl(line.imageKey)}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="cp-photo cp-photo--none" aria-hidden="true" />
      )}
      <div className="cp-row-in">
        <p className="cp-name">{line.name}</p>
        {line.choiceLabel && (
          <div className="cp-size">
            <SizeTag value={line.choiceLabel} />
          </div>
        )}
        <div className="cp-row-foot">
          <span className="cp-price">{baht(line.priceSatang * line.qty)}</span>
          <div className="cp-row-tools">
            <button
              type="button"
              className="cp-trash"
              aria-label="ลบออกจากตะกร้า"
              onClick={onAskRemove}
            >
              <Icon name="trash" size={20} />
            </button>
            <div className="cp-step">
              <button type="button" aria-label="ลดจำนวน" onClick={minus}>
                <Icon name="minus" size={16} />
              </button>
              <span className="cp-qty">{line.qty}</span>
              <button
                type="button"
                aria-label="เพิ่มจำนวน"
                disabled={line.qty >= MAX_QTY}
                onClick={() => setQty(line.variantId, plusStep(line.qty))}
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

/** 4.3 — the empty cart (also what ชำระเงิน shows with nothing to pay for). */
export function EmptyCart({ title }: { title: string }) {
  return (
    <div className="cart-phone">
      <SubHeader title={title} tools={false} />
      <div className="cp-empty">
        <span className="cp-empty-icon" aria-hidden="true">
          <Icon name="cart" size={30} />
        </span>
        <p className="cp-empty-t">ตะกร้ายังว่างอยู่</p>
        <Link href="/products" className="cp-btn-red cp-empty-btn">
          เลือกซื้อสินค้า
        </Link>
      </div>
    </div>
  );
}

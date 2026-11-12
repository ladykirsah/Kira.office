"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { addToCart } from "@/lib/cart";
import { baht } from "@/lib/format";
import { imgUrl } from "@/lib/img";
import { track } from "@/lib/track";
import {
  canConfirm,
  chipState,
  choicePrice,
  clampQty,
  sheetHead,
  type PickChoice,
} from "@/lib/sizePicker";
import { Sheet } from "@/components/home/CarSheets";

export interface SizeSheetProduct {
  productId: string;
  name: string;
  productRef: string;
  brandName: string | null;
}

/**
 * The Shopee-style size sheet (board 3b, owner's pick A, 11 Nov 2026): the picked size's photo, red
 * price and "เหลือ N ชิ้น · ขนาด X" (the range and "เลือกขนาด" before a pick), one chip per size — picked
 * = light red with a red ring, sold out = grey "หมด" and not tappable — the จำนวน stepper, and the
 * button, grey until a size is picked. It adds THAT size to the cart; ซื้อเลย then goes to checkout.
 */
export function SizeSheet({
  product,
  choices,
  action,
  now,
  onClose,
  onAdded,
}: {
  product: SizeSheetProduct;
  choices: PickChoice[];
  /** which button opened it — its label is the sheet's button */
  action: "cart" | "buy";
  now: number;
  onClose: () => void;
  /** after the add: the card / page closes the sheet and says so, or goes to checkout */
  onAdded: (action: "cart" | "buy") => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const picked = choices.find((c) => c.variantId === pickedId) ?? null;
  const head = sheetHead(choices, pickedId, now);
  const ready = canConfirm(choices, pickedId);
  const optionName = choices.find((c) => c.optionName)?.optionName?.trim() || "ขนาด";
  const label = action === "buy" ? "ซื้อเลย" : "ใส่ตะกร้า";

  function pick(c: PickChoice) {
    if (chipState(c, pickedId) === "out") return;
    setPickedId(c.variantId);
    setQty((q) => clampQty(q, c.onHand));
  }

  function confirm() {
    if (!ready || !picked) return;
    track("add_to_cart", product.productId);
    addToCart(
      {
        variantId: picked.variantId,
        productId: product.productId,
        name: product.name,
        productRef: product.productRef,
        brandName: product.brandName,
        priceSatang: choicePrice(picked, now),
        imageKey: picked.imageKey,
        ...(picked.value ? { choiceLabel: picked.value } : {}),
      },
      clampQty(qty, picked.onHand),
    );
    onAdded(action);
  }

  const sheet = (
    <Sheet title="" left="ปิด" onLeft={onClose}>
      <div className="sz-head">
        <span className="sz-pic">
          {head.imageKey ? (
            <img src={imgUrl(head.imageKey)} alt="" />
          ) : (
            <span aria-hidden="true">✦</span>
          )}
        </span>
        <span className="sz-head-text">
          <span className="sz-price">{head.price}</span>
          <span className="sz-sub">{head.sub}</span>
        </span>
      </div>
      <div className="sz-block">
        <b className="sz-title">{optionName}</b>
        <div className="sz-chips" role="radiogroup" aria-label={optionName}>
          {choices.map((c) => {
            const state = chipState(c, pickedId);
            return (
              <button
                key={c.variantId}
                type="button"
                role="radio"
                aria-checked={state === "picked"}
                disabled={state === "out"}
                className={`sz-chip sz-chip--${state}`}
                onClick={() => pick(c)}
              >
                <span className="sz-chip-v">{c.value}</span>
                <span className="sz-chip-p">
                  {state === "out" ? "หมด" : baht(choicePrice(c, now))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="sz-qty">
        <b className="sz-title">จำนวน</b>
        <span className="sz-stepper">
          <button
            type="button"
            aria-label="ลดจำนวน"
            disabled={qty <= 1}
            onClick={() => setQty((q) => clampQty(q - 1, picked?.onHand ?? 1))}
          >
            −
          </button>
          <span aria-live="polite">{qty}</span>
          <button
            type="button"
            aria-label="เพิ่มจำนวน"
            disabled={!picked || qty >= picked.onHand}
            onClick={() => setQty((q) => clampQty(q + 1, picked?.onHand ?? 1))}
          >
            +
          </button>
        </span>
      </div>
      <div className="sz-foot">
        <button
          type="button"
          className={ready ? "sz-go" : "sz-go sz-go--off"}
          disabled={!ready}
          onClick={confirm}
        >
          {label}
        </button>
      </div>
    </Sheet>
  );
  return typeof document === "undefined" ? null : createPortal(sheet, document.body);
}

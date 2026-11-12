"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { imgUrl } from "@/lib/img";
import { hasSizes, type PickChoice } from "@/lib/sizePicker";
import { Icon } from "@/components/Icon";
import { SizeSheet, type SizeSheetProduct } from "@/components/SizeSheet";

type Action = "cart" | "buy";

interface Sizes {
  /** the product has sizes, so ใส่ตะกร้า / ซื้อเลย ask for one first */
  sized: boolean;
  open: (action: Action) => void;
  /** a size was just added (the bar's cart button shows ✓ เพิ่มแล้ว) */
  added: boolean;
}

const NONE: Sizes = { sized: false, open: () => {}, added: false };
const SizesContext = createContext<Sizes>(NONE);

/** What the product page's buy bar and ตัวเลือก row share: whether there are sizes, and the sheet. */
export function useProductSizes(): Sizes {
  return useContext(SizesContext);
}

/**
 * The product page's sizes (board 3b.4–3b.7, 11 Nov 2026): one size sheet that the ตัวเลือก row,
 * ใส่ตะกร้า and ซื้อเลย all open. ใส่ตะกร้า closes it and says เพิ่มลงตะกร้าแล้ว; ซื้อเลย goes to checkout.
 * A product without sizes passes straight through.
 */
export function ProductSizesProvider({
  product,
  choices,
  children,
}: {
  product: SizeSheetProduct;
  choices: PickChoice[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const sized = hasSizes(choices);
  const [action, setAction] = useState<Action | null>(null);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function onAdded(a: Action) {
    setAction(null);
    if (a === "buy") {
      router.push("/checkout");
      return;
    }
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1600);
  }

  const value: Sizes = sized ? { sized, open: (a) => setAction(a), added } : NONE;
  return (
    <SizesContext.Provider value={value}>
      {children}
      {sized && action && (
        <SizeSheet
          product={product}
          choices={choices}
          action={action}
          now={Date.now()}
          onClose={() => setAction(null)}
          onAdded={onAdded}
        />
      )}
      {added && (
        <div className="ap-toast" role="status" aria-live="polite">
          <Icon name="check" size={15} />
          เพิ่มลงตะกร้าแล้ว
        </div>
      )}
    </SizesContext.Provider>
  );
}

/** The ตัวเลือก row: "เลือกขนาด · 3 แบบ ›" and one 1:1 thumb per size; a tap opens the size sheet. */
export function ChoicesRow({ choices }: { choices: PickChoice[] }) {
  const sizes = useProductSizes();
  if (!sizes.sized) return null;
  const optionName = choices.find((c) => c.optionName)?.optionName?.trim() || "ขนาด";
  return (
    <button type="button" className="sz-row" onClick={() => sizes.open("cart")}>
      <span className="sz-row-top">
        <span className="sz-row-label">ตัวเลือก</span>
        <span className="sz-row-words">
          เลือก{optionName} · {choices.length} แบบ
        </span>
        <Icon name="chevron" size={15} style={{ color: "#c7c7cc" }} />
      </span>
      <span className="sz-thumbs" aria-hidden="true">
        {choices.map((c) => (
          <span key={c.variantId} className="sz-thumb">
            {c.imageKey ? <img src={imgUrl(c.imageKey)} alt="" loading="lazy" /> : null}
          </span>
        ))}
      </span>
    </button>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogItem } from "@/lib/db";
import type { PickChoice } from "@/lib/sizePicker";
import { productHref } from "@/lib/seo";
import { Icon } from "@/components/Icon";
import { SizeSheet, type SizeSheetProduct } from "@/components/SizeSheet";

/**
 * A card's 🛒 on a product with sizes (board 3b.2, 11 Nov 2026): it opens the size sheet instead of
 * putting the cheapest size in the cart unasked. The sizes load on the tap; if they can't, the
 * shopper goes to the product page, where the same sheet is.
 */
export function useCardSizePick(item: CatalogItem) {
  const router = useRouter();
  const [data, setData] = useState<{ product: SizeSheetProduct; choices: PickChoice[] } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(item.productId)}/choices`);
      if (!res.ok) throw new Error(`choices ${res.status}`);
      setData((await res.json()) as { product: SizeSheetProduct; choices: PickChoice[] });
    } catch (err) {
      console.error("[card size sheet] could not load the sizes", err);
      router.push(productHref(item));
    } finally {
      setBusy(false);
    }
  }

  function onAdded(action: "cart" | "buy") {
    setData(null);
    if (action === "buy") {
      router.push("/checkout");
      return;
    }
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1600);
  }

  const element = (
    <>
      {data && (
        <SizeSheet
          product={data.product}
          choices={data.choices}
          action="cart"
          now={Date.now()}
          onClose={() => setData(null)}
          onAdded={onAdded}
        />
      )}
      {added && (
        <div className="ap-toast" role="status" aria-live="polite">
          <Icon name="check" size={15} />
          เพิ่มลงตะกร้าแล้ว
        </div>
      )}
    </>
  );
  return { open, busy, added, element };
}

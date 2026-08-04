"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track";

/**
 * Fires one `page_view` per route, for the whole storefront.
 *
 * Mounted once in the root layout. `usePathname()` changes on every client-side navigation, so this
 * covers soft navigations too — without it the app-router would record only the first page of a
 * visit and every session would look one page deep. The effect deliberately depends on the path
 * alone: a re-render from state elsewhere on the page is not a new view.
 */
export function TrackPageView() {
  const pathname = usePathname();
  useEffect(() => {
    track("page_view");
  }, [pathname]);
  return null;
}

/**
 * Fires `product_view` — Shopee's ยอดการมองเห็นสินค้า — when a product detail page is opened.
 *
 * Sits alongside the existing `RecordView`, which keeps the visitor's own "ดูล่าสุด" list in
 * localStorage. Same moment, two different jobs: that one is for the customer, this one is for the
 * shop, and neither can see the other's data.
 */
export function TrackProductView({ productId }: { productId: string }) {
  useEffect(() => {
    track("product_view", productId);
  }, [productId]);
  return null;
}

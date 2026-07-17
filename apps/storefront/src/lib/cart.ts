"use client";

import { useSyncExternalStore } from "react";

/**
 * Client-side cart: localStorage only, no server persistence before checkout (fewest steps —
 * the whole AirPlus bet is a faster checkout than the inw.me-style competitors). Prices are
 * DISPLAY-ONLY here; the checkout API re-reads authoritative prices from D1 and never trusts
 * the client's numbers.
 */
export interface CartLine {
  variantId: string;
  productId: string;
  name: string;
  productRef: string;
  /** Brand label (e.g. "DENSO"), shown as the cart-line pill. Optional: carts saved before this
   *  field existed, and reorder lines, simply omit it — the pill is hidden when absent. */
  brandName?: string | null;
  priceSatang: number;
  imageKey: string | null;
  qty: number;
}

const KEY = "airplus.cart.v1";
const EVENT = "airplus:cart";

function readRaw(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        typeof l === "object" &&
        l !== null &&
        typeof (l as CartLine).variantId === "string" &&
        typeof (l as CartLine).qty === "number" &&
        (l as CartLine).qty > 0,
    );
  } catch {
    return [];
  }
}

function write(lines: CartLine[]): void {
  // Persist best-effort — a full/blocked store (private mode, quota) must not throw out of
  // addToCart/clearCart. Update the in-memory cache + notify regardless, so the UI (badge, cart page,
  // post-order redirect) stays consistent even when localStorage refuses the write. Matches the
  // best-effort setItem in recentSearches.ts / RecentlyViewed.tsx / coupons.ts.
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* ignore — persistence is best-effort */
  }
  cache = lines;
  window.dispatchEvent(new Event(EVENT));
}

export function addToCart(line: Omit<CartLine, "qty">, qty = 1): void {
  const lines = readRaw();
  const existing = lines.find((l) => l.variantId === line.variantId);
  if (existing) existing.qty += qty;
  else lines.push({ ...line, qty });
  write(lines);
}

/** qty <= 0 removes the line. */
export function setQty(variantId: string, qty: number): void {
  const lines = readRaw();
  const next =
    qty > 0
      ? lines.map((l) => (l.variantId === variantId ? { ...l, qty } : l))
      : lines.filter((l) => l.variantId !== variantId);
  write(next);
}

export function removeLine(variantId: string): void {
  setQty(variantId, 0);
}

export function clearCart(): void {
  write([]);
}

export function cartTotalSatang(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.priceSatang * l.qty, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

/* ---- React subscription (header badge, cart page) ---- */

let cache: CartLine[] = [];
let cacheLoaded = false;
const EMPTY: CartLine[] = [];

function subscribe(onChange: () => void): () => void {
  const handler = () => {
    cache = readRaw();
    onChange();
  };
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler); // cross-tab
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function getSnapshot(): CartLine[] {
  if (!cacheLoaded) {
    cache = readRaw();
    cacheLoaded = true;
  }
  return cache;
}

/** Live cart lines. Server snapshot is empty (cart is a purely client concept). */
export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

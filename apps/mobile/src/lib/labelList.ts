import type { LabelSize } from "./barcodeLabel";

/**
 * The labels waiting on ออกบาร์โค้ด's sheet (บนแผ่น): one item per product and size, with how many
 * to print. The sheet lives on the phone until the page is left, as in the old back office. Every
 * change returns a new list. No screen code here.
 */

export interface SheetItem {
  /** productId:size — one product may be on the sheet as L and as S. */
  key: string;
  productId: string;
  size: LabelSize;
  qty: number;
}

const atLeastOne = (n: number) => Math.max(1, Math.round(n));

/** Adds a product's labels; the same product at the same size again just adds to its amount. */
export function addLabel(
  list: readonly SheetItem[],
  productId: string,
  size: LabelSize,
  qty: number,
): SheetItem[] {
  const key = `${productId}:${size}`;
  if (list.some((i) => i.key === key)) {
    return list.map((i) => (i.key === key ? { ...i, qty: i.qty + atLeastOne(qty) } : i));
  }
  return [...list, { key, productId, size, qty: atLeastOne(qty) }];
}

/** The card's − n +: never below 1 (taking a label off is the label sheet's ลบออกจากแผ่น). */
export function setLabelQty(list: readonly SheetItem[], key: string, qty: number): SheetItem[] {
  return list.map((i) => (i.key === key ? { ...i, qty: atLeastOne(qty) } : i));
}

export function removeLabel(list: readonly SheetItem[], key: string): SheetItem[] {
  return list.filter((i) => i.key !== key);
}

/** One entry per printed label, in list order — what the page planner lays out. */
export function copiesOf(
  list: readonly SheetItem[],
  lines: (productId: string) => number,
): { size: LabelSize; lines: number; item: string }[] {
  return list.flatMap((i) =>
    Array.from({ length: i.qty }, () => ({ size: i.size, lines: lines(i.productId), item: i.key })),
  );
}

export function labelCount(list: readonly SheetItem[]): number {
  return list.reduce((n, i) => n + i.qty, 0);
}

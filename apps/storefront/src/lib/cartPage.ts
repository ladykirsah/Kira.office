import { cartCount, cartTotalSatang, type CartLine } from "./cart";
import { baht } from "./format";

/** Phone cart words and steps (board 4 · 4.1–4.3, owner: "Yes, build board 4", 14 Nov 2026). */
export const MAX_QTY = 99;

/** The bar title: "ตะกร้า (3)" — pieces, not lines — or "ตะกร้า" when empty (4.3). */
export function cartTitle(lines: CartLine[]): string {
  const n = cartCount(lines);
  return n > 0 ? `ตะกร้า (${n})` : "ตะกร้า";
}

/** The bottom bar's three lines beside ชำระเงิน. */
export function cartTotals(lines: CartLine[]): { countLine: string; total: string; note: string } {
  return {
    countLine: `รวม ${cartCount(lines)} ชิ้น`,
    total: baht(cartTotalSatang(lines)),
    note: "ยังไม่รวมค่าส่ง",
  };
}

/** − on a line: one fewer, or at 1 ask whether to remove it (4.2). */
export function minusStep(qty: number): number | "ask-remove" {
  return qty <= 1 ? "ask-remove" : qty - 1;
}

/** + on a line: one more, never past 99. */
export function plusStep(qty: number): number {
  return Math.min(MAX_QTY, qty + 1);
}

import type { Phrase } from "@/lib/lang";

/**
 * The column words the three Finance tables share — and, with them, the expense rows that sit
 * inside two of those tables.
 *
 * WHY THIS IS SHARED. On a phone every row is a CARD: the header row is hidden, and each cell
 * repeats its own column's word as a `data-label` so the number beside it means something. Two
 * things go wrong when each table keeps its own copy:
 *   - the same column drifts to two different words, so the same number reads differently
 *     depending on which tab you are on
 *   - a row rendered by a SHARED component (an expense row) has no word of its own to use, and
 *     ships as a bare number under no label at all — which is what happened
 * One map, read by the `th` and by every `td` under it, is what keeps a card honest.
 */
export const COLUMN = {
  job: { th: "งาน", en: "Job" },
  orderId: { th: "เลขคำสั่งซื้อ", en: "Order ID" },
  sales: { th: "ยอดขาย", en: "Sales" },
  /** Shopee's "Total" is what the SELLER receives, which is not the same as the sale. */
  total: { th: "ยอดรับ", en: "Total" },
  fees: { th: "ค่าธรรมเนียม", en: "Fees" },
  profit: { th: "กำไร", en: "Profit" },
  date: { th: "วันที่", en: "Date" },
  status: { th: "สถานะ", en: "Status" },
  action: { th: "จัดการ", en: "Action" },
} satisfies Record<string, Phrase>;

/**
 * The columns an expense row fills, in the order its cells are written. It is money OUT, so it has
 * no Sales figure — that cell shows an em dash — and its identity is the expense's own name rather
 * than a job or an order number.
 */
export const EXPENSE_COLUMNS = ["sales", "profit", "date", "status"] as const;

import type { Phrase } from "@l-shopee/shared/lang";
import { formatBaht } from "./money";
import { clockTime, dayTitle, startOfDay } from "./orderList";

/** One payment on the การชำระเงิน list, as GET /payments sends it (cleared ones are not sent). */
export interface PaymentRow {
  id: string;
  methodLabel: string;
  promptpayId: string;
  amountSatang: number;
  /** The counter bill it paid for; null for a QR made on this page. */
  saleNumber: string | null;
  status: string;
  createdAt: number;
  approvedAt: number | null;
  slipRef: string | null;
  confirmedAt: number | null;
}

/** อนุมัติแล้ว · รอตรวจสลิป (slip checking on, not yet checked) · สลิปยืนยันแล้ว. */
export type PayState = "approved" | "awaitingSlip" | "slipConfirmed";

export const STATE_WORDS: Record<PayState, Phrase> = {
  approved: { th: "อนุมัติแล้ว", en: "Approved" },
  awaitingSlip: { th: "รอตรวจสลิป", en: "Slip to check" },
  slipConfirmed: { th: "สลิปยืนยันแล้ว", en: "Slip confirmed" },
};

export interface AccountTotal {
  label: string;
  satang: number;
}

export interface DaySummary {
  totalSatang: number;
  count: number;
  /** How many slips are checked; null while slip checking is off. */
  checked: number | null;
  byAccount: AccountTotal[];
}

/** "08x-xxx-4421": enough to tell the accounts apart, never the whole number on a list. */
export function maskPromptpay(id: string): string {
  const d = id.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 2)}x-xxx-${d.slice(-4)}`;
  return `xxx-${d.slice(-4)}`;
}

/** The row's grey line: its time, and the bill it paid for when it came from ทำบิล or Scan. */
export function rowSub(r: PaymentRow): Phrase {
  const time = clockTime(r.createdAt);
  return r.saleNumber
    ? { th: `${time} · บิล ${r.saleNumber}`, en: `${time} · Bill ${r.saleNumber}` }
    : { th: time, en: time };
}

export function payState(r: PaymentRow, slipCheckOn: boolean): PayState {
  if (r.slipRef || r.status === "confirmed") return "slipConfirmed";
  return slipCheckOn ? "awaitingSlip" : "approved";
}

/** วันนี้, เมื่อวาน, then dates; the server already sends them newest first. */
export function paymentDays(
  rows: readonly PaymentRow[],
  now: number,
): { title: Phrase; rows: PaymentRow[] }[] {
  const days: { day: number; title: Phrase; rows: PaymentRow[] }[] = [];
  for (const r of [...rows].sort((a, b) => b.createdAt - a.createdAt)) {
    const day = startOfDay(r.createdAt);
    const last = days[days.length - 1];
    if (last && last.day === day) last.rows.push(r);
    else days.push({ day, title: dayTitle(day, now), rows: [r] });
  }
  return days.map(({ title, rows: list }) => ({ title, rows: list }));
}

function byAccount(rows: readonly PaymentRow[]): AccountTotal[] {
  const totals = new Map<string, number>();
  for (const r of rows)
    totals.set(r.methodLabel, (totals.get(r.methodLabel) ?? 0) + r.amountSatang);
  return [...totals.entries()]
    .map(([label, satang]) => ({ label, satang }))
    .sort((a, b) => b.satang - a.satang);
}

const total = (rows: readonly PaymentRow[]) => rows.reduce((sum, r) => sum + r.amountSatang, 0);

/** The top card: what came in by PromptPay today, and into which account. */
export function todaySummary(
  rows: readonly PaymentRow[],
  now: number,
  slipCheckOn: boolean,
): DaySummary {
  const today = rows.filter((r) => startOfDay(r.createdAt) === startOfDay(now));
  return {
    totalSatang: total(today),
    count: today.length,
    checked: slipCheckOn ? today.filter((r) => payState(r, true) === "slipConfirmed").length : null,
    byAccount: byAccount(today),
  };
}

/** "5 รายการ · ร้าน ฿9,860 · แม่ ฿2,590", with "ตรวจแล้ว 2" when slips are being checked. */
export function summaryLine(s: DaySummary): Phrase {
  const accounts = s.byAccount.map((a) => `${a.label} ${formatBaht(a.satang)}`);
  const th = [`${s.count} รายการ`, s.checked == null ? "" : `ตรวจแล้ว ${s.checked}`, ...accounts];
  const en = [`${s.count} payments`, s.checked == null ? "" : `${s.checked} checked`, ...accounts];
  return { th: th.filter(Boolean).join(" · "), en: en.filter(Boolean).join(" · ") };
}

/** What ล้าง takes off the list: every payment on it, by account. */
export function clearSummary(rows: readonly PaymentRow[]): {
  count: number;
  totalSatang: number;
  byAccount: AccountTotal[];
} {
  return { count: rows.length, totalSatang: total(rows), byAccount: byAccount(rows) };
}

const MAX_WHOLE_DIGITS = 7;

/** One keypad tap on the amount as typed: digits, one point, two decimals, ⌫ takes one back. */
export function keypadPress(value: string, key: string): string {
  if (key === "⌫") return value.slice(0, -1);
  const [whole = "", decimals] = value.split(".");
  if (key === ".") {
    if (decimals !== undefined) return value;
    return `${whole || "0"}.`;
  }
  if (!/^\d$/.test(key)) return value;
  if (decimals !== undefined) return decimals.length >= 2 ? value : value + key;
  if (whole === "0") return key;
  return whole.length >= MAX_WHOLE_DIGITS ? value : value + key;
}

export function amountSatang(value: string): number {
  const n = Number(value || "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** The big number while typing: "฿1,250", "฿12." — the point shows as soon as it is tapped. */
export function amountText(value: string): string {
  const [whole = "", decimals] = value.split(".");
  const grouped = Number(whole || "0").toLocaleString("en-US");
  return decimals === undefined ? `฿${grouped}` : `฿${grouped}.${decimals}`;
}

/** Why a save, a clear or a slip check failed, in words: no internet, not the owner, or the server's. */
export function paymentTrouble(err: unknown): Phrase {
  const msg = err instanceof Error ? err.message : "";
  if (err instanceof TypeError || !msg)
    return { th: "ไม่มีเน็ต ลองอีกครั้ง", en: "No internet · try again" };
  if (msg === "forbidden") return { th: "ทำได้เฉพาะเจ้าของร้าน", en: "The shop owner only" };
  return { th: msg, en: msg };
}

import type { Phrase } from "@l-shopee/shared/lang";
import { formatBaht } from "./money";
import { dayPill, rangeLabel, shortDate } from "./orderList";
import { parseBaht } from "./productEdit";

/**
 * The rules behind คูปอง (owner approved the drawing, canvas v252, 1 Nov 2026): AirPlus checkout
 * codes, each with its discount (a percent, or baht), a minimum, how often it may be used and when.
 * No screen code here. The server keeps percent as basis points (10% = 1000) and baht as satang.
 */

/** One row of GET /coupons. */
export interface Coupon {
  id: string;
  code: string;
  name: string | null;
  /** percent or fixed (baht off). */
  type: string;
  value: number;
  minSubtotalSatang: number;
  /** A ceiling on the discount; null = none. */
  maxDiscountSatang: number | null;
  startsAt: number | null;
  endsAt: number | null;
  /** Uses across every customer; null = no limit. */
  maxUses: number | null;
  maxUsesPerCustomer: number;
  /** active or disabled (เปิดใช้ off). */
  status: string;
  createdAt: number;
  redemptions: number;
  /** The staff member who made it; null for coupons made before the shop kept this. */
  createdByName: string | null;
}

/** usedUp is not on the drawing: a coupon with every use taken can't be used, so it doesn't say ใช้ได้อยู่. */
export type CouponState = "live" | "waiting" | "off" | "ended" | "usedUp";

export const STATE_WORDS: Record<CouponState, Phrase> = {
  live: { th: "ใช้ได้อยู่", en: "In use" },
  waiting: { th: "รอเริ่ม", en: "Starts later" },
  off: { th: "ปิดอยู่", en: "Off" },
  ended: { th: "หมดอายุแล้ว", en: "Expired" },
  usedUp: { th: "ใช้ครบแล้ว", en: "All used" },
};

/** The dot beside the words (the words stay grey). */
export const STATE_TONE: Record<CouponState, "success" | "waiting" | "muted"> = {
  live: "success",
  waiting: "waiting",
  off: "muted",
  ended: "muted",
  usedUp: "muted",
};

export function couponState(c: Coupon, now: number): CouponState {
  if (c.status !== "active") return "off";
  if (c.endsAt != null && c.endsAt < now) return "ended";
  if (c.maxUses != null && c.redemptions >= c.maxUses) return "usedUp";
  if (c.startsAt != null && c.startsAt > now) return "waiting";
  return "live";
}

// ── the list ─────────────────────────────────────────────────────────────────────────────────────

export type CouponFilter = "all" | "on" | "off" | "ended";

export const FILTERS: readonly { key: CouponFilter; label: Phrase }[] = [
  { key: "all", label: { th: "ทั้งหมด", en: "All" } },
  { key: "on", label: { th: "เปิดอยู่", en: "On" } },
  { key: "off", label: { th: "ปิดอยู่", en: "Off" } },
  { key: "ended", label: { th: "หมดอายุ", en: "Expired" } },
];

/** เปิดอยู่ = switched on and not run out, so one still waiting to start counts too (as drawn). */
function filterOf(c: Coupon, now: number): Exclude<CouponFilter, "all"> {
  const state = couponState(c, now);
  return state === "off" ? "off" : state === "ended" ? "ended" : "on";
}

export function inFilter(c: Coupon, filter: CouponFilter, now: number): boolean {
  return filter === "all" || filterOf(c, now) === filter;
}

export function filterCounts(
  coupons: readonly Coupon[],
  now: number,
): Record<CouponFilter, number> {
  const counts = { all: coupons.length, on: 0, off: 0, ended: 0 };
  for (const c of coupons) counts[filterOf(c, now)] += 1;
  return counts;
}

/** The ticket's big value: "10%" (basis points), "฿200" (satang). */
export function bigValue(c: Coupon): string {
  return c.type === "percent" ? `${c.value / 100}%` : formatBaht(c.value);
}

/**
 * After the code: the minimum spend, else the cap, else ไม่มีขั้นต่ำ (as drawn). Only a percent coupon
 * has a cap (the form has no ลดสูงสุด for baht), so one the web back office gave a baht coupon is not said.
 */
export function conditionLine(c: Coupon): Phrase {
  if (c.minSubtotalSatang > 0) {
    const min = formatBaht(c.minSubtotalSatang);
    return { th: `เมื่อซื้อครบ ${min}`, en: `On ${min} or more` };
  }
  if (c.type === "percent" && c.maxDiscountSatang != null) {
    const cap = formatBaht(c.maxDiscountSatang);
    return { th: `ลดสูงสุด ${cap}`, en: `Up to ${cap} off` };
  }
  return { th: "ไม่มีขั้นต่ำ", en: "No minimum" };
}

function usedLine(c: Coupon): Phrase {
  return c.maxUses != null
    ? { th: `ใช้ไป ${c.redemptions} จาก ${c.maxUses}`, en: `${c.redemptions} of ${c.maxUses} used` }
    : { th: `ใช้ไป ${c.redemptions}`, en: `${c.redemptions} used` };
}

/** "ใช้ได้อยู่ · ใช้ไป 12 จาก 100"; a coupon still waiting also says its first day. */
export function cardLine(c: Coupon, now: number): Phrase {
  const state = couponState(c, now);
  const words = STATE_WORDS[state];
  const parts: Phrase[] = [words];
  if (state === "waiting" && c.startsAt != null) parts.push(shortDate(c.startsAt));
  parts.push(usedLine(c));
  return {
    th: parts.map((p) => p.th).join(" · "),
    en: parts.map((p) => p.en).join(" · "),
  };
}

// ── one coupon's page ────────────────────────────────────────────────────────────────────────────

/** Under the big code: "ลด 10% สูงสุด ฿300", "ลด ฿80". */
export function discountLine(c: Coupon): Phrase {
  const value = bigValue(c);
  if (c.type === "percent" && c.maxDiscountSatang != null) {
    const cap = formatBaht(c.maxDiscountSatang);
    return { th: `ลด ${value} สูงสุด ${cap}`, en: `${value} off, up to ${cap}` };
  }
  return { th: `ลด ${value}`, en: `${value} off` };
}

/** ใช้ไปแล้ว: "12 จาก 100", or the count alone when there is no limit. */
export function usedValue(c: Coupon): Phrase {
  return c.maxUses != null
    ? { th: `${c.redemptions} จาก ${c.maxUses}`, en: `${c.redemptions} of ${c.maxUses}` }
    : { th: `${c.redemptions} ครั้ง`, en: `${c.redemptions} times` };
}

/** How full the bar under ใช้ไปแล้ว is; no bar without a limit. */
export function usedShare(c: Coupon): number | null {
  if (c.maxUses == null || c.maxUses <= 0) return null;
  return Math.min(1, c.redemptions / c.maxUses);
}

/** ช่วงเวลา on the page, with the Thai year: "1–30 พ.ย. 2569". */
export function pageWindow(startsAt: number | null, endsAt: number | null): Phrase {
  if (startsAt == null && endsAt == null) return { th: "ตลอดเวลา", en: "Always" };
  if (startsAt != null && endsAt != null) {
    const [a, b] = [new Date(startsAt), new Date(endsAt)];
    if (a.getFullYear() !== b.getFullYear()) {
      const [first, last] = [dayPill(startsAt), dayPill(endsAt)];
      return { th: `${first.th} – ${last.th}`, en: `${first.en} – ${last.en}` };
    }
    const range = rangeLabel({ from: startsAt, to: endsAt });
    return {
      th: `${range.th} ${b.getFullYear() + 543}`,
      en: `${range.en} ${b.getFullYear()}`,
    };
  }
  if (startsAt != null) {
    const d = dayPill(startsAt);
    return { th: `ตั้งแต่ ${d.th}`, en: `From ${d.en}` };
  }
  const d = dayPill(endsAt);
  return { th: `ถึง ${d.th}`, en: `Until ${d.en}` };
}

export function creatorName(c: Coupon): string {
  return c.createdByName?.trim() || "—";
}

/** ลบคูปอง on one that has been used: it is part of the shop's sales, so it is switched off instead. */
export const USED_TOAST: { title: Phrase; detail: Phrase } = {
  title: { th: "มีคนใช้แล้ว ลบไม่ได้", en: "Already used, so it can't be deleted" },
  detail: { th: "ปิดใช้ในแก้ไขแทน", en: "Turn it off in Edit instead" },
};

export function COPIED_TOAST(code: string): Phrase {
  return { th: `คัดลอก ${code} แล้ว`, en: `${code} copied` };
}

// ── the form ─────────────────────────────────────────────────────────────────────────────────────

/** The boxes as typed. Money in baht ("1,000"), percent as "10". */
export interface CouponForm {
  name: string;
  kind: "percent" | "fixed";
  amount: string;
  /** ลดสูงสุด (percent only); empty or ฿0 = no cap. */
  cap: string;
  /** ซื้อขั้นต่ำ; empty or ฿0 = no minimum. */
  minimum: string;
  code: string;
  /** ใช้ได้ทั้งหมด; empty or 0 = no limit. */
  maxUses: string;
  perCustomer: string;
  startsAt: number | null;
  endsAt: number | null;
  /** เปิดใช้ (edit only; a new coupon starts on). */
  on: boolean;
}

export function emptyForm(): CouponForm {
  return {
    name: "",
    kind: "percent",
    amount: "",
    cap: "",
    minimum: "",
    code: "",
    maxUses: "",
    perCustomer: "1",
    startsAt: null,
    endsAt: null,
    on: true,
  };
}

/** Satang as a box holds it: "1,000"; nothing (or ฿0 for a minimum) → an empty box. */
const moneyBox = (satang: number | null) => (satang == null ? "" : formatBaht(satang).slice(1));

export function formOf(c: Coupon): CouponForm {
  const percent = c.type === "percent";
  return {
    name: c.name ?? "",
    kind: percent ? "percent" : "fixed",
    amount: percent ? String(c.value / 100) : moneyBox(c.value),
    cap: moneyBox(c.maxDiscountSatang),
    minimum: c.minSubtotalSatang > 0 ? moneyBox(c.minSubtotalSatang) : "",
    code: c.code,
    maxUses: c.maxUses != null ? String(c.maxUses) : "",
    perCustomer: String(c.maxUsesPerCustomer),
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    on: c.status === "active",
  };
}

const PERCENT = /^\d+(\.\d{1,2})?$/;

/** The discount as the server keeps it: basis points or satang; 0 when missing or not a number. */
function amountValue(form: CouponForm): number {
  const raw = form.amount.replace(/,/g, "").trim();
  if (form.kind === "percent") return PERCENT.test(raw) ? Math.round(Number(raw) * 100) : 0;
  return parseBaht(raw) ?? 0;
}

const count = (text: string) => Math.round(Number(text.trim()) || 0);

function sharedBody(form: CouponForm) {
  const cap = form.kind === "percent" ? (parseBaht(form.cap) ?? 0) : 0;
  const uses = count(form.maxUses);
  return {
    name: form.name.trim(),
    type: form.kind,
    value: amountValue(form),
    maxDiscountSatang: cap > 0 ? cap : null,
    minSubtotalSatang: parseBaht(form.minimum) ?? 0,
    maxUses: uses > 0 ? uses : null,
    maxUsesPerCustomer: Math.max(1, count(form.perCustomer)),
    startsAt: form.startsAt,
    endsAt: form.endsAt,
  };
}

export function createBody(form: CouponForm) {
  return { ...sharedBody(form), code: cleanCode(form.code) };
}

/** The code is locked once made (as drawn), so an edit never sends it. */
export function patchBody(form: CouponForm) {
  return { ...sharedBody(form), status: form.on ? "active" : "disabled" };
}

export type FormField = "name" | "amount" | "code" | "perCustomer";

/**
 * บันทึก with a box left empty: only the empty ones say so, under themselves (owner, 1 Nov 2026: fill
 * them in any order; ฿0 is fine for ลดสูงสุด and ซื้อขั้นต่ำ). More than 100% off is the one other stop.
 */
export function formProblems(form: CouponForm, isNew: boolean): Partial<Record<FormField, Phrase>> {
  const out: Partial<Record<FormField, Phrase>> = {};
  if (!form.name.trim()) out.name = { th: "ยังไม่ได้ใส่ชื่อคูปอง", en: "No name yet" };
  const value = amountValue(form);
  if (value <= 0) out.amount = { th: "ยังไม่ได้ใส่ส่วนลด", en: "No discount yet" };
  else if (form.kind === "percent" && value > 10000) {
    out.amount = { th: "ลดได้ไม่เกิน 100%", en: "No more than 100%" };
  }
  if (isNew && !cleanCode(form.code)) out.code = { th: "ยังไม่ได้ใส่โค้ด", en: "No code yet" };
  if (count(form.perCustomer) <= 0) {
    out.perCustomer = { th: "ยังไม่ได้ใส่จำนวนครั้งต่อคน", en: "No uses per customer yet" };
  }
  return out;
}

/** The server refused the code: another coupon has it. */
export function duplicateProblem(code: string): Phrase {
  const c = cleanCode(code);
  return { th: `มีโค้ด ${c} แล้ว`, en: `${c} is already a code` };
}

/** A money box keeps digits, commas and one dot (two places after it). */
export function cleanMoney(text: string): string {
  const kept = text.replace(/[^\d.,]/g, "");
  const dot = kept.indexOf(".");
  if (dot < 0) return kept;
  const after = kept.slice(dot + 1).replace(/[.,]/g, "");
  return `${kept.slice(0, dot)}.${after.slice(0, 2)}`;
}

export function cleanCount(text: string): string {
  return text.replace(/\D/g, "");
}

/** Codes are capitals with no spaces (the server keeps them so). */
export function cleanCode(text: string): string {
  return text.replace(/\s/g, "").toUpperCase();
}

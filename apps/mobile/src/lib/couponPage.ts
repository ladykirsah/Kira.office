import type { Phrase } from "@l-shopee/shared/lang";
import { formatBaht } from "./money";
import { dayPill, rangeLabel, shortDate } from "./orderList";
import { parseBaht } from "./productEdit";
import {
  NEW_CUSTOMER_DAYS,
  scopeProblem,
  type CouponScope,
  type CouponTarget,
} from "./couponRules";

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
  /** order (the product price) or shipping (ส่งฟรี = 100% off the fee). */
  appliesTo: string;
  /** ใช้กับ: all, or the brands / categories / car models / products in targets. */
  scope: string;
  targets: CouponTarget[];
  /** ลูกค้าใหม่: accounts made in this window hold it for validDays; null = everyone. */
  signupFrom: number | null;
  signupTo: number | null;
  validDays: number | null;
}

const onShipping = (c: Pick<Coupon, "appliesTo">) => c.appliesTo === "shipping";
const isFreeShipping = (c: Pick<Coupon, "appliesTo" | "type" | "value">) =>
  onShipping(c) && c.type === "percent" && c.value >= 10000;

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

/** The card's big value: "10%" (basis points), "฿200" (satang), "ส่งฟรี". */
export function bigValue(c: Coupon): string {
  if (isFreeShipping(c)) return "ส่งฟรี";
  return c.type === "percent" ? `${c.value / 100}%` : formatBaht(c.value);
}

function usedLine(c: Coupon): Phrase {
  return c.maxUses != null
    ? { th: `ใช้ไป ${c.redemptions} จาก ${c.maxUses}`, en: `${c.redemptions} of ${c.maxUses} used` }
    : { th: `ใช้ไป ${c.redemptions}`, en: `${c.redemptions} used` };
}

// ── card C (owner picked it with changes, canvas v266) ──────────────────────────────────────────

/** The card's top line: what the coupon takes money off. */
export function kindLine(c: Coupon): Phrase {
  return onShipping(c)
    ? { th: "ส่วนลดค่าส่ง", en: "Shipping discount" }
    : { th: "ส่วนลดสินค้า", en: "Product discount" };
}

/** Beside the big value: "สูงสุด ฿300". Only a percent has a cap (the form has none for baht). */
export function capLine(c: Coupon): Phrase | null {
  if (c.type !== "percent" || isFreeShipping(c) || c.maxDiscountSatang == null) return null;
  const cap = formatBaht(c.maxDiscountSatang);
  return { th: `สูงสุด ${cap}`, en: `Up to ${cap}` };
}

/** What a ใช้กับ rule covers, said after สำหรับ: "สินค้า DENSO, Sanden"; null for every product. */
function coverage(c: Coupon): Phrase | null {
  const names = c.targets.map((t) => t.name).join(", ");
  if (c.scope === "products" && c.targets.length > 0) {
    const n = c.targets.length;
    return { th: `สินค้าที่เลือก ${n} ชิ้น`, en: `${n} picked products` };
  }
  if (!names) return null;
  if (c.scope === "brand") return { th: `สินค้า ${names}`, en: `${names} products` };
  if (c.scope === "category") return { th: `สินค้าหมวด ${names}`, en: `${names} products` };
  if (c.scope === "car_model") {
    return { th: `สินค้า ${names} เท่านั้น`, en: `${names} products only` };
  }
  return null;
}

/**
 * The card's short rule: สำหรับทุกออเดอร์ · สำหรับสินค้า Cool Gear · สำหรับลูกค้าใหม่ (owner's words,
 * 1 Nov 2026). Not drawn: a ลูกค้าใหม่ coupon on some products says both, who first.
 */
export function forLine(c: Coupon): Phrase {
  const what = coverage(c);
  if (c.signupFrom != null) {
    return what
      ? { th: `สำหรับลูกค้าใหม่ · ${what.th}`, en: `For new customers · ${what.en}` }
      : { th: "สำหรับลูกค้าใหม่", en: "For new customers" };
  }
  return what
    ? { th: `สำหรับ${what.th}`, en: `For ${what.en}` }
    : { th: "สำหรับทุกออเดอร์", en: "For every order" };
}

/** A day on the card: "30 พ.ย.", with the Thai year when it is not this year's. */
function cardDay(ms: number, now: number): Phrase {
  return new Date(ms).getFullYear() === new Date(now).getFullYear() ? shortDate(ms) : dayPill(ms);
}

/** How it stands: ใช้ได้ถึง 30 พ.ย. · ใช้ได้ตลอด · เปิดตัว 11 พ.ย. · ใช้ไม่ได้ · หมดอายุแล้ว. */
export function stateLine(c: Coupon, now: number): Phrase {
  const state = couponState(c, now);
  if (state === "off") return { th: "ใช้ไม่ได้", en: "Can't be used" };
  if (state === "waiting" && c.startsAt != null) {
    const day = cardDay(c.startsAt, now);
    return { th: `เปิดตัว ${day.th}`, en: `Starts ${day.en}` };
  }
  if (state === "live") {
    if (c.endsAt == null) return { th: "ใช้ได้ตลอด", en: "No end date" };
    const day = cardDay(c.endsAt, now);
    return { th: `ใช้ได้ถึง ${day.th}`, en: `Until ${day.en}` };
  }
  return STATE_WORDS[state];
}

/** The grey line under the hairline: "ซื้อครบ ฿1,000 · ใช้ไป 12 จาก 100". */
export function footLine(c: Coupon): Phrase {
  const min = formatBaht(c.minSubtotalSatang);
  const first: Phrase =
    c.minSubtotalSatang > 0
      ? { th: `ซื้อครบ ${min}`, en: `On ${min} or more` }
      : { th: "ไม่มีขั้นต่ำ", en: "No minimum" };
  const used = usedLine(c);
  return { th: `${first.th} · ${used.th}`, en: `${first.en} · ${used.en}` };
}

// ── one coupon's page ────────────────────────────────────────────────────────────────────────────

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

/** ลบคูปอง shows only while nobody has used it: a used one is part of the shop's sales (in use = no delete). */
export function canDelete(c: Pick<Coupon, "redemptions">): boolean {
  return c.redemptions === 0;
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
  /** ส่วนลด on ราคาสินค้า (the product price) or ค่าส่ง (the shipping fee). */
  cuts: "product" | "shipping";
  /** free = ส่งฟรี (shipping only). */
  kind: "percent" | "fixed" | "free";
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
  scope: CouponScope;
  targets: CouponTarget[];
  /** ใครใช้ได้ = ลูกค้าใหม่: accounts made in สมัครช่วง get it, for a year each. */
  newCustomers: boolean;
  signupFrom: number | null;
  signupTo: number | null;
}

export function emptyForm(): CouponForm {
  return {
    name: "",
    cuts: "product",
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
    scope: "all",
    targets: [],
    newCustomers: false,
    signupFrom: null,
    signupTo: null,
  };
}

/** Satang as a box holds it: "1,000"; nothing (or ฿0 for a minimum) → an empty box. */
const moneyBox = (satang: number | null) => (satang == null ? "" : formatBaht(satang).slice(1));

export function formOf(c: Coupon): CouponForm {
  const percent = c.type === "percent";
  const free = isFreeShipping(c);
  return {
    name: c.name ?? "",
    cuts: onShipping(c) ? "shipping" : "product",
    kind: free ? "free" : percent ? "percent" : "fixed",
    amount: free ? "" : percent ? String(c.value / 100) : moneyBox(c.value),
    cap: moneyBox(c.maxDiscountSatang),
    minimum: c.minSubtotalSatang > 0 ? moneyBox(c.minSubtotalSatang) : "",
    code: c.code,
    maxUses: c.maxUses != null ? String(c.maxUses) : "",
    perCustomer: String(c.maxUsesPerCustomer),
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    on: c.status === "active",
    scope: (c.scope as CouponScope) ?? "all",
    targets: c.targets ?? [],
    newCustomers: c.signupFrom != null,
    signupFrom: c.signupFrom,
    signupTo: c.signupTo,
  };
}

const PERCENT = /^\d+(\.\d{1,2})?$/;

/** The discount as the server keeps it: basis points or satang; 0 when missing or not a number. */
function amountValue(form: CouponForm): number {
  if (form.kind === "free") return 10000;
  const raw = form.amount.replace(/,/g, "").trim();
  if (form.kind === "percent") return PERCENT.test(raw) ? Math.round(Number(raw) * 100) : 0;
  return parseBaht(raw) ?? 0;
}

const count = (text: string) => Math.round(Number(text.trim()) || 0);

function sharedBody(form: CouponForm) {
  const shipping = form.cuts === "shipping";
  const cap = form.kind === "percent" && !shipping ? (parseBaht(form.cap) ?? 0) : 0;
  const uses = count(form.maxUses);
  // A ลูกค้าใหม่ coupon has no dates of its own: each customer holds it a year from joining.
  const fresh = form.newCustomers;
  return {
    name: form.name.trim(),
    // ส่งฟรี is 100% off the shipping fee.
    type: form.kind === "free" ? "percent" : form.kind,
    value: amountValue(form),
    maxDiscountSatang: cap > 0 ? cap : null,
    minSubtotalSatang: parseBaht(form.minimum) ?? 0,
    maxUses: uses > 0 ? uses : null,
    maxUsesPerCustomer: Math.max(1, count(form.perCustomer)),
    startsAt: fresh ? null : form.startsAt,
    endsAt: fresh ? null : form.endsAt,
    appliesTo: shipping ? "shipping" : "order",
    scope: form.scope,
    targets: form.scope === "all" ? [] : form.targets.map((t) => t.id),
    signupFrom: fresh ? form.signupFrom : null,
    signupTo: fresh ? form.signupTo : null,
    validDays: fresh ? NEW_CUSTOMER_DAYS : null,
  };
}

export function createBody(form: CouponForm) {
  return { ...sharedBody(form), code: cleanCode(form.code) };
}

/** The code is locked once made (as drawn), so an edit never sends it. */
export function patchBody(form: CouponForm) {
  return { ...sharedBody(form), status: form.on ? "active" : "disabled" };
}

export type FormField = "name" | "amount" | "code" | "perCustomer" | "scope" | "when";

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
  const scope = scopeProblem(form.scope, form.targets);
  if (scope) out.scope = scope;
  if (form.newCustomers && (form.signupFrom == null || form.signupTo == null)) {
    out.when = { th: "ยังไม่ได้เลือกช่วงสมัคร", en: "No sign-up dates yet" };
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

/**
 * Coupon catalog + the shopper's "collected" wallet.
 *
 * Two pages consume this: /coupons lists the FULL catalog (collect a code), /account/coupons shows
 * the codes you've COLLECTED (ready to use). Persistence is client-side localStorage for now — a
 * device-local mock; swap for a member-scoped `coupons` + collected-coupons backend when it ships.
 */

export type CouponKind = "money" | "ship";

export interface Coupon {
  kind: CouponKind; // money = ฿/% off (coral) · ship = free/discounted shipping (green)
  value: string; // "฿100" | "10%" | "ส่งฟรี" | "-฿30"
  title: string;
  cond: string;
  code: string;
  expiry: string;
}

export const ALL_COUPONS: Coupon[] = [
  {
    kind: "money",
    value: "฿100",
    title: "ส่วนลด ฿100",
    cond: "เมื่อซื้อครบ ฿1,000",
    code: "AIRPLUS100",
    expiry: "31 ก.ค. 2026",
  },
  {
    kind: "money",
    value: "10%",
    title: "ลด 10% ทั้งร้าน",
    cond: "ลดสูงสุด ฿500",
    code: "SAVE10",
    expiry: "31 ก.ค. 2026",
  },
  {
    kind: "ship",
    value: "ส่งฟรี",
    title: "ส่งฟรีทั่วไทย",
    cond: "ไม่มีขั้นต่ำ",
    code: "FREESHIP",
    expiry: "15 ส.ค. 2026",
  },
  {
    kind: "ship",
    value: "-฿30",
    title: "ลดค่าจัดส่ง ฿30",
    cond: "ทุกคำสั่งซื้อ",
    code: "SHIP30",
    expiry: "15 ส.ค. 2026",
  },
  {
    kind: "money",
    value: "฿150",
    title: "สมาชิกใหม่ ลด ฿150",
    cond: "สำหรับคำสั่งซื้อแรก",
    code: "WELCOME150",
    expiry: "31 ธ.ค. 2026",
  },
  {
    kind: "money",
    value: "฿500",
    title: "ลด ฿500",
    cond: "เมื่อซื้อครบ ฿5,000",
    code: "BIG500",
    expiry: "31 ก.ค. 2026",
  },
];

const STORE_KEY = "airplus.collectedCoupons";

/** Codes the shopper has collected (client-only wallet). Safe to call in the browser only. */
export function readCollectedCodes(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeCollectedCodes(codes: string[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(codes));
  } catch {
    /* storage unavailable (private mode / disabled) — collecting just won't persist */
  }
}

/** Robust copy: async Clipboard API, then an execCommand fallback for blocked contexts. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

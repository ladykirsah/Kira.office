import type { Phrase } from "@l-shopee/shared/lang";

/**
 * โปรไฟล์ของฉัน (canvas v335, 4 Nov 2026): your own page, opened from the badge on หน้าหลัก and from
 * your name at the top of ☰. Read only — the owner edits names and the bank at พนักงาน — but you set
 * your own day off, password, 6-digit code and (the owner alone) the emergency key.
 */

export type Section = "name" | "app" | "access" | "work" | "bank" | "pay" | "daysOff" | "emergency";
export type Access = "password" | "pin" | "key";

export const PROFILE_ROUTE = "/profile";
export const OWN_PAY_ROUTE = `${PROFILE_ROUTE}/pay`;
export const ownPayMonthRoute = (period: string) => `${OWN_PAY_ROUTE}/${period}`;

/** The pay day the old /me page stated; the shop pays on the 5th. */
export const PAY_DAY: Phrase = { th: "ทุกวันที่ 5", en: "The 5th of each month" };

/**
 * The owner's order (*"reordering"*, 4 Nov 2026): ชื่อ · แอป · การเข้าใช้งาน · บัญชีธนาคาร · วันหยุด ·
 * ผู้ติดต่อฉุกเฉิน. Someone paid by the day also has งาน just above บัญชีธนาคาร and เงินเดือน just
 * below it, so the money sits together.
 */
export function profileSections(p: { dayRateSatang: number | null }): Section[] {
  const paid = p.dayRateSatang != null;
  return [
    "name",
    "app",
    "access",
    ...(paid ? (["work"] as const) : []),
    "bank",
    ...(paid ? (["pay"] as const) : []),
    "daysOff",
    "emergency",
  ];
}

/** รหัสผ่าน only with an email to sign in with; กุญแจฉุกเฉิน is the owner's alone. */
export function accessRows(p: { email: string | null; role: string }): Access[] {
  return [
    ...(p.email ? (["password"] as const) : []),
    "pin",
    ...(p.role === "super_admin" ? (["key"] as const) : []),
  ];
}

/** The three sign-in rows — the page's labels and their sheets' titles. */
export const ACCESS_LABEL: Record<Access, Phrase> = {
  password: { th: "รหัสผ่าน", en: "Password" },
  pin: { th: "รหัส 6 หลัก", en: "6-digit code" },
  key: { th: "กุญแจฉุกเฉิน", en: "Emergency key" },
};

const NOT_SET: Phrase = { th: "ยังไม่ได้ตั้ง", en: "Not set" };
const SHOWN: Record<Access, Phrase> = {
  password: { th: "••••••••", en: "••••••••" },
  pin: { th: "••• •••", en: "••• •••" },
  key: { th: "ตั้งแล้ว", en: "Set" },
};

/** A row's value: dots for your own codes (no copy — you don't hand them out), or ยังไม่ได้ตั้ง. */
export const codeShown = (kind: Access, isSet: boolean): Phrase => (isSet ? SHOWN[kind] : NOT_SET);

const PASSWORD_MIN = 8;
const KEY_MIN = 4;
const SHORT = {
  password: { th: "รหัสผ่านอย่างน้อย 8 ตัว", en: "At least 8 characters" },
  key: { th: "กุญแจอย่างน้อย 4 ตัว", en: "At least 4 characters" },
} satisfies Partial<Record<Access, Phrase>>;

/** What a sheet says before it sends anything: an empty box, or too short. */
export function newCodeProblem(kind: Access, value: string): Phrase | null {
  const v = value.trim();
  if (kind === "pin") return /^\d{6}$/.test(v) ? null : { th: "ตัวเลข 6 ตัว", en: "6 digits" };
  if (kind === "password") {
    if (!v) return { th: "ยังไม่ได้ใส่รหัสใหม่", en: "No new password yet" };
    return value.length < PASSWORD_MIN ? SHORT.password : null;
  }
  if (!v) return { th: "ยังไม่ได้ใส่กุญแจใหม่", en: "No new key yet" };
  return v.length < KEY_MIN ? SHORT.key : null;
}

const TAKEN: Partial<Record<Access, Phrase>> = {
  pin: { th: "มีคนใช้รหัสนี้แล้ว เลือกใหม่", en: "Someone uses this code. Choose another" },
  key: { th: "มีคนใช้กุญแจนี้แล้ว เลือกใหม่", en: "Someone uses this key. Choose another" },
};

/**
 * The server's own-account answers are English sentences (they predate this app); the sheet shows
 * the drawn words. 409 is someone else holding it; the rest is matched on the sentence.
 */
export function refusedWords(kind: Access, status: number, message: string): Phrase {
  if (status === 409 && TAKEN[kind]) return TAKEN[kind];
  if (status === 400) {
    if (/too easy/i.test(message)) {
      return { th: "รหัสนี้เดาง่าย เลือกใหม่", en: "Too easy to guess. Choose another" };
    }
    if (/6 digits/i.test(message)) return { th: "ตัวเลข 6 ตัว", en: "6 digits" };
    if (/at least/i.test(message) && kind !== "pin") return SHORT[kind];
  }
  return { th: "บันทึกไม่สำเร็จ ลองอีกครั้ง", en: "Not saved. Try again" };
}

/** Your month of days off in date order (the server sends newest first). */
export const daysInOrder = <T extends { day: string }>(days: readonly T[]): T[] =>
  [...days].sort((a, b) => a.day.localeCompare(b.day));

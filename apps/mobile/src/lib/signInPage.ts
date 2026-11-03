import type { Lang, Phrase } from "@l-shopee/shared/lang";

/**
 * เข้าใช้งาน as drawn on the canvas (LoginPhone v328, owner "Apply to preview", 3 Nov 2026): a
 * รหัส 6 หลัก | อีเมล switch, the red เข้าใช้งาน that is never greyed — tapped too early, it says what
 * is missing under the boxes — and ลืมรหัส? as the grey second choice, with the emergency key behind it.
 */

export type SignInTab = "pin" | "password";

/** Under the six boxes, once เข้าใช้งาน was tapped with fewer than six digits. */
export function pinProblem(pin: string): Phrase | null {
  return /^\d{6}$/.test(pin) ? null : { th: "ใส่รหัสให้ครบ 6 หลัก", en: "Enter all 6 digits" };
}

/** Under the email card, once เข้าใช้งาน was tapped: one line per box still empty. */
export function mailProblems(email: string, password: string): Phrase[] {
  return [
    ...(email.trim() === "" ? [{ th: "ยังไม่ได้ใส่อีเมล", en: "Email is empty" }] : []),
    ...(password === "" ? [{ th: "ยังไม่ได้ใส่รหัสผ่าน", en: "Password is empty" }] : []),
  ];
}

export function keyProblem(key: string): Phrase | null {
  return key.trim() === "" ? { th: "ยังไม่ได้ใส่กุญแจ", en: "The key is empty" } : null;
}

/** The pill at the top right names the other language in its own words. */
export const langSwitchLabel = (lang: Lang): string => (lang === "th" ? "English" : "ไทย");

export const forgotLabel = (tab: SignInTab): Phrase => ({
  th: "ลืมรหัส?",
  en: tab === "pin" ? "Forgot PIN?" : "Forgot password?",
});

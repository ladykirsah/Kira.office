import type { Phrase } from "@l-shopee/shared/lang";
import type { Credentials, SignInFailure } from "./signIn";

/**
 * What the sign-in screen says when a door refuses. Every phrase is the web sign-in card's own
 * (apps/admin/src/app/login/LoginForm.tsx), so the two never disagree about the same refusal.
 *
 * One deliberate difference: the web card answers a throttled PIN or password with "wrong PIN",
 * because its relay folds 429 into a plain refusal. Waiting is not failing, so here every door gets
 * the "too many tries" sentence the web card already uses for the emergency key.
 */
const WRONG: Record<Credentials["kind"], Phrase> = {
  pin: { th: "ไม่มีใครใช้รหัสนี้", en: "That PIN doesn't match anyone." },
  password: { th: "อีเมลหรือรหัสผ่านไม่ถูกต้อง", en: "Email or password is wrong." },
  key: { th: "กุญแจนี้เปิดไม่ได้", en: "That key does not open this." },
  practice: { th: "มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง", en: "Something went wrong. Try again." },
};

const NOT_ABOUT_THE_CREDENTIAL: Record<Exclude<SignInFailure, "invalid">, Phrase> = {
  unreachable: {
    th: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่",
    en: "Can't reach the server. Check the connection and try again.",
  },
  locked: {
    th: "ใส่ผิด 3 ครั้ง บัญชีนี้ถูกล็อก 24 ชั่วโมง",
    en: "This account is locked for 24 hours after 3 failed tries.",
  },
  needs_reset: {
    th: "บัญชีนี้ต้องตั้งรหัสใหม่ — ระบบตรวจไม่ได้ ถึงจะใส่ถูกก็ตาม ให้ซูเปอร์แอดมินตั้งรหัสผ่านหรือรหัส 6 หลักให้ใหม่",
    en: "This login needs resetting — it can't be checked, even if it's correct. Ask a super admin to set a new password or PIN.",
  },
  pin_login_unavailable: {
    th: "ยังไม่ได้เปิดให้เข้าด้วยรหัส 6 หลัก ใช้อีเมลกับรหัสผ่านแทน",
    en: "PIN sign-in isn't set up yet. Use email and password.",
  },
  too_many_attempts: {
    th: "ลองมาหลายครั้งแล้ว รออีกสัก 15 นาทีแล้วค่อยลองใหม่",
    en: "Too many tries. Wait about 15 minutes, then try again.",
  },
  not_available: {
    th: "เครื่องนี้ยังไม่ได้ตั้งให้เข้าใช้งานแบบคลิกเดียว — เพิ่ม PRACTICE_COPY=1 ใน .dev.vars แล้วเริ่มใหม่",
    en: "This copy is not set up for one-click sign-in. Add PRACTICE_COPY=1 to .dev.vars and restart it.",
  },
};

export function signInMessage(kind: Credentials["kind"], failure: SignInFailure): Phrase {
  return failure === "invalid" ? WRONG[kind] : NOT_ABOUT_THE_CREDENTIAL[failure];
}

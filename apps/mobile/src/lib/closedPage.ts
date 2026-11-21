import type { Phrase } from "@l-shopee/shared/lang";
import type { ClosedFor } from "@l-shopee/shared/nav";

const FOR_ACCOUNT: Phrase = {
  th: "บัญชีนี้เปิดหน้านี้ไม่ได้",
  en: "This account can't open this page.",
};

const WORDS: Record<ClosedFor, { title: Phrase; body: Phrase }> = {
  owner: { title: { th: "หน้านี้สำหรับเจ้าของร้าน", en: "For the owner only" }, body: FOR_ACCOUNT },
  "owner-admin": {
    title: { th: "หน้านี้สำหรับเจ้าของร้านและผู้ดูแล", en: "For the owner and admins only" },
    body: FOR_ACCOUNT,
  },
  airplus: {
    title: { th: "หน้านี้ใช้กับร้านที่มีเว็บ AirPlus", en: "For shops with the AirPlus website" },
    body: { th: "ร้านนี้ยังไม่มีเว็บ AirPlus", en: "This shop has no AirPlus website yet." },
  },
};

/**
 * The card on a page this person can't open, in the words of the role names on พนักงาน (plan 11.5,
 * 20 Nov 2026): who the page is for, and why it is closed. Its one button is หน้าหลัก.
 */
export function closedWords(why: ClosedFor): { title: Phrase; body: Phrase } {
  return WORDS[why];
}

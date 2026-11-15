import type { Phrase } from "@l-shopee/shared/lang";

/**
 * What an address with no page shows (plan step 1.2, drawing NotFoundPage, 15 Nov 2026). Every menu
 * page lives here now and the old back office is switched off (4 Nov), so this is only an old or
 * mistyped link: say so plainly and offer the way back. Never send staff to the old back office.
 */
export const NOT_FOUND_WORDS: { title: Phrase; body: Phrase; button: Phrase } = {
  title: { th: "ไม่มีหน้านี้ในแอป", en: "This page isn’t in the app" },
  body: {
    th: "ลิงก์อาจเก่าหรือพิมพ์ผิด เลือกหน้าจากเมนู ☰ หรือกลับหน้าหลัก",
    en: "The link may be old or mistyped. Pick a page from the ☰ menu, or go back Home.",
  },
  button: { th: "หน้าหลัก", en: "Home" },
};

/** The card's line for this screen: a computer has the menu on the left, not a ☰ button. */
export function notFoundBody(wide: boolean): Phrase {
  if (!wide) return NOT_FOUND_WORDS.body;
  return {
    th: "ลิงก์อาจเก่าหรือพิมพ์ผิด เลือกหน้าจากเมนูด้านซ้าย หรือกลับหน้าหลัก",
    en: "The link may be old or mistyped. Pick a page from the menu on the left, or go back Home.",
  };
}

/** หน้าหลัก, where the card's one button goes. */
export const HOME_ROUTE = "/";

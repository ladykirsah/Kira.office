import { describe, expect, it } from "vitest";
import { HOME_ROUTE, NOT_FOUND_WORDS, notFoundBody } from "./notFoundPage";

describe("notFoundPage", () => {
  it("card title > given the drawing (plan 1.2, 15 Nov) > then it says the page is not in the app", () => {
    expect(NOT_FOUND_WORDS.title).toEqual({
      th: "ไม่มีหน้านี้ในแอป",
      en: "This page isn’t in the app",
    });
  });

  it("card line > given the drawing > then it says why and where to go", () => {
    expect(NOT_FOUND_WORDS.body).toEqual({
      th: "ลิงก์อาจเก่าหรือพิมพ์ผิด เลือกหน้าจากเมนู ☰ หรือกลับหน้าหลัก",
      en: "The link may be old or mistyped. Pick a page from the ☰ menu, or go back Home.",
    });
  });

  it("card line > given a phone > then it points at the ☰ menu", () => {
    expect(notFoundBody(false)).toEqual(NOT_FOUND_WORDS.body);
  });

  it("card line > given a computer (menu on the left, no ☰) > then it points at the menu on the left", () => {
    expect(notFoundBody(true)).toEqual({
      th: "ลิงก์อาจเก่าหรือพิมพ์ผิด เลือกหน้าจากเมนูด้านซ้าย หรือกลับหน้าหลัก",
      en: "The link may be old or mistyped. Pick a page from the menu on the left, or go back Home.",
    });
  });

  it("button > given the drawing > then it is one word and opens หน้าหลัก", () => {
    expect(NOT_FOUND_WORDS.button).toEqual({ th: "หน้าหลัก", en: "Home" });
    expect(HOME_ROUTE).toBe("/");
  });

  it("words > given the old back office is switched off (4 Nov) > then none of them send staff there", () => {
    const all = [...Object.values(NOT_FOUND_WORDS), notFoundBody(true)].flatMap((p) => [
      p.th,
      p.en,
    ]);
    for (const w of all) {
      expect(w).not.toMatch(/ระบบหลังร้านเดิม|ระบบเดิม|back office/i);
    }
  });
});

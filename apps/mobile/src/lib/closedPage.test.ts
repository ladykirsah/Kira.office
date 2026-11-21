import { describe, expect, it } from "vitest";
import { closedWords } from "./closedPage";

// Plan 11.5 (20 Nov 2026): an address the menu hides from this person, or a page for shops with the
// AirPlus website, says so on one card with a หน้าหลัก button, instead of an empty frame.
describe("closedWords", () => {
  it("closedWords > given the owner's page > then it says the page is for the owner", () => {
    expect(closedWords("owner").title).toEqual({
      th: "หน้านี้สำหรับเจ้าของร้าน",
      en: "For the owner only",
    });
  });

  it("closedWords > given a page for the owner and admins > then it names both", () => {
    expect(closedWords("owner-admin").title).toEqual({
      th: "หน้านี้สำหรับเจ้าของร้านและผู้ดูแล",
      en: "For the owner and admins only",
    });
  });

  it("closedWords > given a role's page > then it says this account cannot open it", () => {
    expect(closedWords("owner").body).toEqual({
      th: "บัญชีนี้เปิดหน้านี้ไม่ได้",
      en: "This account can't open this page.",
    });
  });

  it("closedWords > given an AirPlus page at a shop without the website > then it says the shop has none", () => {
    expect(closedWords("airplus")).toEqual({
      title: { th: "หน้านี้ใช้กับร้านที่มีเว็บ AirPlus", en: "For shops with the AirPlus website" },
      body: { th: "ร้านนี้ยังไม่มีเว็บ AirPlus", en: "This shop has no AirPlus website yet." },
    });
  });
});

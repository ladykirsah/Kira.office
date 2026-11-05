import { describe, expect, it } from "vitest";
import { draftsNote, pickOnEnter } from "./posPage";

const part = (id: string) => ({ id });

describe("pickOnEnter", () => {
  it("pickOnEnter > given nothing typed > then nothing happens", () => {
    expect(pickOnEnter([part("a"), part("b")], "  ")).toEqual({ kind: "none" });
  });

  it("pickOnEnter > given exactly one match > then that part goes on the bill", () => {
    expect(pickOnEnter([part("a")], "TG447610")).toEqual({ kind: "add", row: part("a") });
  });

  it("pickOnEnter > given no match (a scanner's barcode) > then the code is looked up", () => {
    expect(pickOnEnter([], " 8851234567890 ")).toEqual({ kind: "code", code: "8851234567890" });
  });

  it("pickOnEnter > given several matches > then nothing happens, the person picks one", () => {
    expect(pickOnEnter([part("a"), part("b")], "ตู้แอร์")).toEqual({ kind: "none" });
  });
});

describe("draftsNote", () => {
  it("draftsNote > given a phone > then the swipe left to delete", () => {
    expect(draftsNote(false).th).toBe(
      "แตะเพื่อทำบิลต่อ · บิลที่ทำค้างไว้เก็บเป็นร่างให้ก่อน · ปัดซ้ายเพื่อลบ (ถามก่อนลบ) · ฉบับร่างไม่ตัดสต็อก",
    );
  });

  it("draftsNote > given a computer > then the bin icon to delete, no swipe", () => {
    expect(draftsNote(true)).toEqual({
      th: "แตะเพื่อทำบิลต่อ · บิลที่ทำค้างไว้เก็บเป็นร่างให้ก่อน · แตะถังขยะเพื่อลบ (ถามก่อนลบ) · ฉบับร่างไม่ตัดสต็อก",
      en: "Click to carry on · the bill on screen is kept first · the bin deletes (asked first) · drafts take no stock",
    });
  });
});

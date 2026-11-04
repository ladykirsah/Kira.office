import { describe, expect, it } from "vitest";
import {
  OWN_PAY_ROUTE,
  PAY_DAY,
  PROFILE_ROUTE,
  accessRows,
  codeShown,
  daysInOrder,
  newCodeProblem,
  ownPayMonthRoute,
  profileSections,
  refusedWords,
} from "./profilePage";

describe("profileSections (โปรไฟล์ของฉัน, owner's order 4 Nov 2026)", () => {
  it("given the owner (no day rate) > then ชื่อ · แอป · การเข้าใช้งาน · บัญชีธนาคาร · วันหยุด · ผู้ติดต่อฉุกเฉิน", () => {
    expect(profileSections({ dayRateSatang: null })).toEqual([
      "name",
      "app",
      "access",
      "bank",
      "daysOff",
      "emergency",
    ]);
  });

  it("given a mechanic with a day rate > then งาน sits above บัญชีธนาคาร and เงินเดือน below it", () => {
    expect(profileSections({ dayRateSatang: 45000 })).toEqual([
      "name",
      "app",
      "access",
      "work",
      "bank",
      "pay",
      "daysOff",
      "emergency",
    ]);
  });
});

describe("accessRows", () => {
  it("given the owner with an email > then รหัสผ่าน, รหัส 6 หลัก and กุญแจฉุกเฉิน", () => {
    expect(accessRows({ email: "k@shop.test", role: "super_admin" })).toEqual([
      "password",
      "pin",
      "key",
    ]);
  });

  it("given a mechanic with no email > then only รหัส 6 หลัก", () => {
    expect(accessRows({ email: null, role: "mechanic" })).toEqual(["pin"]);
  });

  it("given an admin with an email > then no emergency key, which is the owner's alone", () => {
    expect(accessRows({ email: "a@shop.test", role: "admin" })).toEqual(["password", "pin"]);
  });
});

describe("codeShown", () => {
  it("given codes that are set > then dots as drawn, and the key says ตั้งแล้ว", () => {
    expect(codeShown("password", true).th).toBe("••••••••");
    expect(codeShown("pin", true).th).toBe("••• •••");
    expect(codeShown("key", true)).toEqual({ th: "ตั้งแล้ว", en: "Set" });
  });

  it("given nothing set > then ยังไม่ได้ตั้ง", () => {
    expect(codeShown("pin", false)).toEqual({ th: "ยังไม่ได้ตั้ง", en: "Not set" });
    expect(codeShown("key", false)).toEqual({ th: "ยังไม่ได้ตั้ง", en: "Not set" });
  });
});

describe("newCodeProblem (checked before saving)", () => {
  it("given a password under 8 > then รหัสผ่านอย่างน้อย 8 ตัว (1.3)", () => {
    expect(newCodeProblem("password", "kira25")?.th).toBe("รหัสผ่านอย่างน้อย 8 ตัว");
  });

  it("given an empty box > then ยังไม่ได้ใส่…", () => {
    expect(newCodeProblem("password", "  ")?.th).toBe("ยังไม่ได้ใส่รหัสใหม่");
    expect(newCodeProblem("key", "")?.th).toBe("ยังไม่ได้ใส่กุญแจใหม่");
  });

  it("given a PIN that is not 6 digits > then ตัวเลข 6 ตัว (2.2)", () => {
    expect(newCodeProblem("pin", "5129")?.th).toBe("ตัวเลข 6 ตัว");
    expect(newCodeProblem("pin", "")?.th).toBe("ตัวเลข 6 ตัว");
  });

  it("given a key under 4 > then กุญแจอย่างน้อย 4 ตัว", () => {
    expect(newCodeProblem("key", "abc")?.th).toBe("กุญแจอย่างน้อย 4 ตัว");
  });

  it("given good values > then nothing to say", () => {
    expect(newCodeProblem("password", "Kira2569!")).toBeNull();
    expect(newCodeProblem("pin", "730514")).toBeNull();
    expect(newCodeProblem("key", "ดาวเหนือ")).toBeNull();
  });
});

describe("refusedWords (the server's answers in the drawn words)", () => {
  it("given a PIN someone else holds (409) > then มีคนใช้รหัสนี้แล้ว เลือกใหม่ (2.4)", () => {
    expect(refusedWords("pin", 409, "Someone already uses that PIN. Choose another.").th).toBe(
      "มีคนใช้รหัสนี้แล้ว เลือกใหม่",
    );
  });

  it("given a key someone else holds (409) > then มีคนใช้กุญแจนี้แล้ว เลือกใหม่ (1.5)", () => {
    expect(refusedWords("key", 409, "Someone already uses that key. Choose another.").th).toBe(
      "มีคนใช้กุญแจนี้แล้ว เลือกใหม่",
    );
  });

  it("given an easy PIN > then รหัสนี้เดาง่าย เลือกใหม่ (2.3)", () => {
    expect(refusedWords("pin", 400, "That PIN is too easy to guess. Choose another.").th).toBe(
      "รหัสนี้เดาง่าย เลือกใหม่",
    );
  });

  it("given anything else (no connection, a server fault) > then บันทึกไม่สำเร็จ ลองอีกครั้ง", () => {
    expect(refusedWords("password", 0, "Failed to fetch").th).toBe("บันทึกไม่สำเร็จ ลองอีกครั้ง");
    expect(refusedWords("key", 500, "boom").th).toBe("บันทึกไม่สำเร็จ ลองอีกครั้ง");
  });
});

describe("daysInOrder", () => {
  it("given the server's newest-first list > then the month reads in date order, as drawn (3.2)", () => {
    const days = [{ day: "2026-11-04" }, { day: "2026-11-03" }];
    expect(daysInOrder(days).map((d) => d.day)).toEqual(["2026-11-03", "2026-11-04"]);
  });
});

describe("routes and words", () => {
  it("given your own pay > then it lives under โปรไฟล์ของฉัน, not under พนักงาน", () => {
    expect(PROFILE_ROUTE).toBe("/profile");
    expect(OWN_PAY_ROUTE).toBe("/profile/pay");
    expect(ownPayMonthRoute("2026-09")).toBe("/profile/pay/2026-09");
  });

  it("given the pay day > then ทุกวันที่ 5, as the old /me page said", () => {
    expect(PAY_DAY.th).toBe("ทุกวันที่ 5");
  });
});

describe("refusedWords > too short from the server", () => {
  it("given the server's 'at least' sentence > then the drawn too-short words", () => {
    expect(refusedWords("password", 400, "Use at least 8 characters.").th).toBe(
      "รหัสผ่านอย่างน้อย 8 ตัว",
    );
    expect(refusedWords("key", 400, "The emergency key must be at least 4 characters.").th).toBe(
      "กุญแจอย่างน้อย 4 ตัว",
    );
  });
});

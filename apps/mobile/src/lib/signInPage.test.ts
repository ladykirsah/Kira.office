import { describe, expect, it } from "vitest";
import { forgotLabel, keyProblem, langSwitchLabel, mailProblems, pinProblem } from "./signInPage";
import { signInMessage } from "./signInMessage";

/** The เข้าใช้งาน page as drawn on the canvas (LoginPhone, v328, 3 Nov 2026). */
describe("signInPage", () => {
  it("pinProblem > given fewer than 6 digits > ใส่รหัสให้ครบ 6 หลัก; six digits > none", () => {
    expect(pinProblem("")?.th).toBe("ใส่รหัสให้ครบ 6 หลัก");
    expect(pinProblem("1234")?.en).toBe("Enter all 6 digits");
    expect(pinProblem("123456")).toBeNull();
  });

  it("mailProblems > names each empty box, in order; spaces only count as empty", () => {
    expect(mailProblems("", "").map((p) => p.th)).toEqual([
      "ยังไม่ได้ใส่อีเมล",
      "ยังไม่ได้ใส่รหัสผ่าน",
    ]);
    expect(mailProblems("boy@denair.com", "").map((p) => p.th)).toEqual(["ยังไม่ได้ใส่รหัสผ่าน"]);
    expect(mailProblems("  ", "x").map((p) => p.th)).toEqual(["ยังไม่ได้ใส่อีเมล"]);
    expect(mailProblems("boy@denair.com", "secret")).toEqual([]);
  });

  it("keyProblem > given no key > ยังไม่ได้ใส่กุญแจ; a key > none", () => {
    expect(keyProblem("")?.th).toBe("ยังไม่ได้ใส่กุญแจ");
    expect(keyProblem("k-123")).toBeNull();
  });

  it("langSwitchLabel > the other language, in its own words", () => {
    expect(langSwitchLabel("th")).toBe("English");
    expect(langSwitchLabel("en")).toBe("ไทย");
  });

  it("forgotLabel > ลืมรหัส? on both tabs; English names what was forgotten", () => {
    expect(forgotLabel("pin")).toEqual({ th: "ลืมรหัส?", en: "Forgot PIN?" });
    expect(forgotLabel("password")).toEqual({ th: "ลืมรหัส?", en: "Forgot password?" });
  });

  it("signInMessage > needs_reset > the short line as drawn", () => {
    expect(signInMessage("password", "needs_reset").th).toBe(
      "บัญชีนี้ต้องตั้งรหัสใหม่ ให้เจ้าของร้านตั้งให้ใหม่",
    );
  });
});

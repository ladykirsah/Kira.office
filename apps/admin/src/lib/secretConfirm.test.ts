import { describe, expect, it } from "vitest";
import { confirmationProblem } from "./secretConfirm";

/**
 * Typing a new password or PIN twice (owner, 2026-08-25).
 *
 * The cost of a typo here is not "try again" — it is being locked out of the back office. Everywhere
 * else a mistake can be read back off the screen; a password you cannot sign in with cannot be.
 */
describe("confirmationProblem", () => {
  it("given the two entries agree > then nothing is wrong", () => {
    expect(confirmationProblem("hunter2hunter2", "hunter2hunter2")).toBeNull();
    expect(confirmationProblem("482913", "482913")).toBeNull();
  });

  it("given they differ > then says so rather than saving one of them", () => {
    expect(confirmationProblem("hunter2hunter2", "hunter2hunter3")).toBe("ทั้งสองช่องไม่ตรงกัน");
    expect(confirmationProblem("482913", "482914")).toBe("ทั้งสองช่องไม่ตรงกัน");
  });

  it("given the confirmation is still empty > then asks for it, not for a correction", () => {
    // A different message on purpose: "they don't match" is wrong and slightly accusing when the
    // person simply has not typed the second box yet.
    expect(confirmationProblem("hunter2hunter2", "")).toBe("พิมพ์อีกครั้งเพื่อยืนยัน");
    expect(confirmationProblem("hunter2hunter2", "   ")).toBe("พิมพ์อีกครั้งเพื่อยืนยัน");
  });

  /**
   * Judged the way the value will actually be STORED, not the way it was typed. The password is
   * saved trimmed, so a stray trailing space is not a mismatch — refusing a pair that would save
   * identically is a wrong answer the person cannot see the cause of.
   */
  it("given a stray space around one entry > then still a match, because it saves the same", () => {
    expect(confirmationProblem("hunter2hunter2", "hunter2hunter2 ")).toBeNull();
    expect(confirmationProblem("  hunter2hunter2", "hunter2hunter2")).toBeNull();
  });

  it("given both are empty > then asks for the confirmation, and never reports a match", () => {
    expect(confirmationProblem("", "")).toBe("พิมพ์อีกครั้งเพื่อยืนยัน");
  });
});

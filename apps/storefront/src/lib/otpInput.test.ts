import { describe, it, expect } from "vitest";
import { emptyOtp, spreadOtp, backspaceOtp, otpCode, OTP_LEN } from "./otpInput";

describe("emptyOtp", () => {
  it("is 6 empty slots", () => {
    expect(emptyOtp()).toEqual(["", "", "", "", "", ""]);
    expect(emptyOtp().length).toBe(OTP_LEN);
  });
});

describe("spreadOtp > typing one digit", () => {
  it("fills the box and advances focus", () => {
    expect(spreadOtp(emptyOtp(), 0, "5")).toEqual({
      digits: ["5", "", "", "", "", ""],
      focus: 1,
    });
  });

  it("clamps focus at the last box", () => {
    const cur = ["1", "2", "3", "4", "5", ""];
    expect(spreadOtp(cur, 5, "6")).toEqual({
      digits: ["1", "2", "3", "4", "5", "6"],
      focus: 5,
    });
  });

  it("overwrites a filled box in place (select-then-type)", () => {
    expect(spreadOtp(["1", "2", "3", "", "", ""], 1, "9").digits).toEqual([
      "1",
      "9",
      "3",
      "",
      "",
      "",
    ]);
  });
});

describe("spreadOtp > non-digits", () => {
  it("rejects a letter, leaving the box empty and focus put", () => {
    expect(spreadOtp(emptyOtp(), 0, "a")).toEqual({
      digits: ["", "", "", "", "", ""],
      focus: 0,
    });
  });

  it("treats an empty value as a cleared box", () => {
    expect(spreadOtp(["7", "", "", "", "", ""], 0, "")).toEqual({
      digits: ["", "", "", "", "", ""],
      focus: 0,
    });
  });
});

describe("spreadOtp > paste / autofill (multi-char)", () => {
  it("distributes a full 6-digit code from box 0", () => {
    expect(spreadOtp(emptyOtp(), 0, "123456")).toEqual({
      digits: ["1", "2", "3", "4", "5", "6"],
      focus: 5,
    });
  });

  it("distributes from the edited box onward", () => {
    expect(spreadOtp(emptyOtp(), 2, "78")).toEqual({
      digits: ["", "", "7", "8", "", ""],
      focus: 4,
    });
  });

  it("drops overflow past the last box", () => {
    expect(spreadOtp(emptyOtp(), 4, "789")).toEqual({
      digits: ["", "", "", "", "7", "8"],
      focus: 5,
    });
  });

  it("strips non-digits out of a pasted string before distributing", () => {
    expect(spreadOtp(emptyOtp(), 0, "1a2b3c").digits).toEqual(["1", "2", "3", "", "", ""]);
  });
});

describe("backspaceOtp", () => {
  it("clears a filled box in place, keeping focus", () => {
    expect(backspaceOtp(["1", "2", "", "", "", ""], 1)).toEqual({
      digits: ["1", "", "", "", "", ""],
      focus: 1,
    });
  });

  it("on an empty box, clears the previous box and moves focus back", () => {
    expect(backspaceOtp(["1", "", "", "", "", ""], 1)).toEqual({
      digits: ["", "", "", "", "", ""],
      focus: 0,
    });
  });

  it("stays put at box 0", () => {
    expect(backspaceOtp(emptyOtp(), 0)).toEqual({
      digits: ["", "", "", "", "", ""],
      focus: 0,
    });
  });
});

describe("otpCode", () => {
  it("joins a complete set into a 6-digit string", () => {
    expect(otpCode(["1", "2", "3", "4", "5", "6"])).toBe("123456");
    expect(/^\d{6}$/.test(otpCode(["1", "2", "3", "4", "5", "6"]))).toBe(true);
  });

  it("an incomplete set never passes the 6-digit gate", () => {
    expect(/^\d{6}$/.test(otpCode(["1", "2", "", "4", "5", "6"]))).toBe(false);
  });
});

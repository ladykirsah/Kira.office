import { describe, it, expect } from "vitest";
import { crc16ccitt, formatPromptPayTarget, buildPromptPayPayload } from "./promptpay";

describe("crc16ccitt", () => {
  it('given the standard check string "123456789" > returns 29B1', () => {
    expect(crc16ccitt("123456789")).toBe("29B1");
  });
  it("given an empty string > returns the init value FFFF", () => {
    expect(crc16ccitt("")).toBe("FFFF");
  });
});

describe("formatPromptPayTarget", () => {
  it("given a 10-digit phone (with separators) > returns 0066-prefixed 13-char tag-01 target", () => {
    expect(formatPromptPayTarget("081-234-5678")).toEqual({ tag: "01", value: "0066812345678" });
  });
  it("given a 13-digit national/tax id > returns it as a tag-02 target", () => {
    expect(formatPromptPayTarget("1-2345-67890-12-3")).toEqual({
      tag: "02",
      value: "1234567890123",
    });
  });
  it("given a 15-digit e-wallet id > returns it as a tag-03 target", () => {
    expect(formatPromptPayTarget("123456789012345")).toEqual({
      tag: "03",
      value: "123456789012345",
    });
  });
  it("given anything else > throws", () => {
    expect(() => formatPromptPayTarget("12345")).toThrow(/PromptPay/i);
    expect(() => formatPromptPayTarget("")).toThrow(/PromptPay/i);
  });
});

describe("buildPromptPayPayload", () => {
  // CRC is asserted via crc16ccitt, which has its own independent known-answer test above.
  const withCrc = (base: string) => base + crc16ccitt(base);

  it("given a phone and an amount > emits a dynamic (010212) payload with the amount and CRC", () => {
    const base =
      "000201" + // payload format 01
      "010212" + // dynamic (amount present)
      "2937" + // merchant info, 37 chars
      "0016A000000677010111" + // PromptPay AID
      "01130066812345678" + // phone target
      "5802TH" +
      "5303764" +
      "54071450.00" + // ฿1,450.00
      "6304";
    expect(buildPromptPayPayload({ target: "0812345678", amountSatang: 145000 })).toBe(
      withCrc(base),
    );
  });

  it("given no amount > emits a static (010211) payload without tag 54", () => {
    const payload = buildPromptPayPayload({ target: "0812345678" });
    expect(payload).toContain("010211");
    expect(payload).not.toContain("5407");
    expect(payload.endsWith(crc16ccitt(payload.slice(0, -4)))).toBe(true);
  });

  it("given a 13-digit id target > uses merchant sub-tag 02", () => {
    const payload = buildPromptPayPayload({ target: "1234567890123", amountSatang: 10000 });
    expect(payload).toContain("02131234567890123");
  });

  it("given a fractional-satang-free integer > formats amount with 2 decimals", () => {
    expect(buildPromptPayPayload({ target: "0812345678", amountSatang: 8900 })).toContain(
      "540589.00", // 54 + len("89.00")=05 + value
    );
  });

  it("given a non-positive or non-integer amount > throws", () => {
    expect(() => buildPromptPayPayload({ target: "0812345678", amountSatang: 0 })).toThrow(
      /amount/i,
    );
    expect(() => buildPromptPayPayload({ target: "0812345678", amountSatang: -100 })).toThrow(
      /amount/i,
    );
    expect(() => buildPromptPayPayload({ target: "0812345678", amountSatang: 10.5 })).toThrow(
      /amount/i,
    );
  });
});

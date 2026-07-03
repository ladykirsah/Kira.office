import { describe, it, expect } from "vitest";
import { CHANNELS, ORDER_CHANNELS, isChannel } from "./channels";

describe("channels", () => {
  it("defines the four canonical channels", () => {
    expect(CHANNELS).toEqual(["onsite", "shopee", "airplus", "affiliate"]);
  });

  it("order channels are the marketplace subset", () => {
    expect(ORDER_CHANNELS).toEqual(["shopee", "airplus"]);
    // every order channel is also a channel
    expect(ORDER_CHANNELS.every((c) => (CHANNELS as readonly string[]).includes(c))).toBe(true);
  });

  it("isChannel accepts known channels", () => {
    expect(isChannel("onsite")).toBe(true);
    expect(isChannel("affiliate")).toBe(true);
  });

  it("isChannel rejects unknown values", () => {
    expect(isChannel("airpro")).toBe(false);
    expect(isChannel("")).toBe(false);
  });
});

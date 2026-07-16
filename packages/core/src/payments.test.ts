import { describe, it, expect, vi, afterEach } from "vitest";
import { slipVerificationConfigured, looksLikeSlipQr, verifySlipWithSlipOk } from "./payments";

const CONFIG = { SLIPOK_API_KEY: "k", SLIPOK_BRANCH_ID: "b" };
const QR = "0002010102111234567890123456789012345678";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("slipVerificationConfigured", () => {
  it("given both SlipOK credentials set > returns true", () => {
    expect(slipVerificationConfigured(CONFIG)).toBe(true);
  });
  it("given no credentials > returns false", () => {
    expect(slipVerificationConfigured({})).toBe(false);
  });
  it("given only one of the two credentials > returns false", () => {
    expect(slipVerificationConfigured({ SLIPOK_API_KEY: "k" })).toBe(false);
  });
});

describe("looksLikeSlipQr", () => {
  it("given a plausible slip QR payload > returns true", () => {
    expect(looksLikeSlipQr(QR)).toBe(true);
  });
  it("given a short string > returns false", () => {
    expect(looksLikeSlipQr("hi")).toBe(false);
  });
  it("given a string containing whitespace > returns false", () => {
    expect(looksLikeSlipQr("this has spaces in the payload data")).toBe(false);
  });
});

describe("verifySlipWithSlipOk", () => {
  function stubFetch(body: unknown, ok = true) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, json: async () => body } as Response));
  }

  it("given the provider confirms a matching amount > returns ok with the bank transRef", async () => {
    stubFetch({ success: true, data: { transRef: "TR123", amount: 1450 } });
    const out = await verifySlipWithSlipOk(CONFIG, QR, 145000);
    expect(out).toEqual({ ok: true, ref: "TR123", note: JSON.stringify({ amount: 1450 }) });
  });

  it("given the provider rejects the slip > returns a 422 error", async () => {
    stubFetch({ success: false, message: "Invalid slip" });
    const out = await verifySlipWithSlipOk(CONFIG, QR, 145000);
    expect(out).toEqual({ ok: false, code: 422, error: "Invalid slip" });
  });

  it("given the slip amount does not match the expected amount > returns a 422 error", async () => {
    stubFetch({ success: true, data: { transRef: "TR123", amount: 999 } });
    const out = await verifySlipWithSlipOk(CONFIG, QR, 145000);
    expect(out.ok).toBe(false);
    expect(out).toMatchObject({ code: 422 });
  });

  it("given the SlipOK service is unreachable > returns a 502 error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const out = await verifySlipWithSlipOk(CONFIG, QR, 145000);
    expect(out).toEqual({ ok: false, code: 502, error: "slip verification service unreachable" });
  });
});

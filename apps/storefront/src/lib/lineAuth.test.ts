import { describe, it, expect } from "vitest";
import { base64UrlEncode } from "@l-shopee/core";
import {
  dropLinePending,
  lineIdentityFromIdToken,
  peekLinePending,
  stashLinePending,
  takenPhoneReply,
} from "./lineAuth";

const CHANNEL = "2010753164";
const NOW = 1_700_000_000_000;

function idToken(claims: Record<string, unknown>): string {
  const enc = (o: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(o)));
  return `${enc({ alg: "HS256" })}.${enc(claims)}.sig`;
}

const valid = {
  iss: "https://access.line.me",
  aud: CHANNEL,
  sub: "U1234567890",
  name: "สมชาย ใจดี",
  exp: Math.floor(NOW / 1000) + 3600,
};

describe("lineIdentityFromIdToken", () => {
  it("returns the LINE user id + name for a valid token", () => {
    expect(lineIdentityFromIdToken(idToken(valid), CHANNEL, NOW)).toEqual({
      lineUserId: "U1234567890",
      name: "สมชาย ใจดี",
    });
  });

  it("rejects a token minted for a different channel (aud mismatch)", () => {
    expect(lineIdentityFromIdToken(idToken({ ...valid, aud: "9999" }), CHANNEL, NOW)).toBeNull();
  });

  it("rejects a token from the wrong issuer", () => {
    expect(
      lineIdentityFromIdToken(idToken({ ...valid, iss: "https://evil.example" }), CHANNEL, NOW),
    ).toBeNull();
  });

  it("rejects an expired token", () => {
    const expired = { ...valid, exp: Math.floor(NOW / 1000) - 1 };
    expect(lineIdentityFromIdToken(idToken(expired), CHANNEL, NOW)).toBeNull();
  });

  it("rejects a token with no subject", () => {
    const { sub: _drop, ...noSub } = valid;
    void _drop;
    expect(lineIdentityFromIdToken(idToken(noSub), CHANNEL, NOW)).toBeNull();
  });

  it("defaults name to '' when LINE omits it", () => {
    const { name: _drop, ...noName } = valid;
    void _drop;
    expect(lineIdentityFromIdToken(idToken(noName), CHANNEL, NOW)).toEqual({
      lineUserId: "U1234567890",
      name: "",
    });
  });

  it("rejects a garbage token", () => {
    expect(lineIdentityFromIdToken("not-a-jwt", CHANNEL, NOW)).toBeNull();
  });
});

describe("LINE sign-up when the phone number is already used (plan 8.7)", () => {
  function kvEnv() {
    const store = new Map<string, string>();
    const KV = {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => void store.set(k, v),
      delete: async (k: string) => void store.delete(k),
    };
    return { store, env: { KV } as unknown as Parameters<typeof stashLinePending>[0] };
  }

  it("given a refused number > then the sign-up is still there to try another (peek keeps it)", async () => {
    const { env } = kvEnv();
    const token = await stashLinePending(env, { lineUserId: "U1", name: "สมชาย" });
    expect(await peekLinePending(env, token)).toEqual({ lineUserId: "U1", name: "สมชาย" });
    expect(await peekLinePending(env, token)).not.toBeNull();
  });

  it("given the account is made > then the sign-up is used up (drop removes it)", async () => {
    const { env, store } = kvEnv();
    const token = await stashLinePending(env, { lineUserId: "U1", name: "สมชาย" });
    await dropLinePending(env, token);
    expect(store.size).toBe(0);
    expect(await peekLinePending(env, token)).toBeNull();
  });

  it("given the shop's LINE link > then the reply says use another number or message the shop on LINE", () => {
    expect(takenPhoneReply("https://lin.ee/airplus")).toEqual({
      error: "เบอร์นี้ใช้กับบัญชีอื่นแล้ว ใส่เบอร์อื่น หรือทักร้านทาง LINE ให้ช่วย",
      phoneTaken: true,
      lineUrl: "https://lin.ee/airplus",
    });
  });

  it("given no LINE link set for the shop > then it still gives both ways, without a link", () => {
    expect(takenPhoneReply(null)).toEqual({
      error: "เบอร์นี้ใช้กับบัญชีอื่นแล้ว ใส่เบอร์อื่น หรือทักร้านทาง LINE ให้ช่วย",
      phoneTaken: true,
      lineUrl: null,
    });
  });
});

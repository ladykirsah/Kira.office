import { describe, it, expect } from "vitest";
import { base64UrlEncode } from "@l-shopee/core";
import { lineIdentityFromIdToken } from "./lineAuth";

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

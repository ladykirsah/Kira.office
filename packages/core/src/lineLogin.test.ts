import { describe, it, expect } from "vitest";
import {
  base64UrlEncode,
  base64UrlDecode,
  decodeJwtClaims,
  pkceChallengeS256,
  buildLineAuthorizeUrl,
  LINE_AUTHORIZE_URL,
} from "./lineLogin";

/** Build an unsigned-looking JWT (header.payload.sig) from a claims object. */
function makeJwt(claims: Record<string, unknown>): string {
  const enc = (o: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(o)));
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(claims)}.signature-ignored`;
}

describe("base64UrlEncode", () => {
  it("emits URL-safe base64 (- and _), no padding", () => {
    // [255,224,15] → std base64 "/+AP" → url-safe "_-AP"
    expect(base64UrlEncode(new Uint8Array([255, 224, 15]))).toBe("_-AP");
  });

  it("never contains +, /, or = ", () => {
    const out = base64UrlEncode(new Uint8Array([251, 255, 191, 254, 255]));
    expect(out).not.toMatch(/[+/=]/);
  });
});

describe("pkceChallengeS256", () => {
  it("matches the RFC 7636 Appendix B test vector", async () => {
    // The canonical PKCE example — if this passes, the S256 math is correct.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    expect(await pkceChallengeS256(verifier)).toBe(challenge);
  });
});

describe("buildLineAuthorizeUrl", () => {
  const base = {
    channelId: "1234567890",
    redirectUri: "https://airplusauto.com/api/auth/line/callback",
    state: "st_abc",
    codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  };

  it("points at LINE's authorize endpoint with the required OAuth params", () => {
    const url = new URL(buildLineAuthorizeUrl(base));
    expect(`${url.origin}${url.pathname}`).toBe(LINE_AUTHORIZE_URL);
    const q = url.searchParams;
    expect(q.get("response_type")).toBe("code");
    expect(q.get("client_id")).toBe("1234567890");
    expect(q.get("redirect_uri")).toBe(base.redirectUri);
    expect(q.get("state")).toBe("st_abc");
    expect(q.get("code_challenge")).toBe(base.codeChallenge);
    expect(q.get("code_challenge_method")).toBe("S256");
  });

  it("defaults scope to 'openid profile' and omits nonce unless given", () => {
    const q = new URL(buildLineAuthorizeUrl(base)).searchParams;
    expect(q.get("scope")).toBe("openid profile");
    expect(q.has("nonce")).toBe(false);
  });

  it("includes nonce and a custom scope when provided", () => {
    const q = new URL(buildLineAuthorizeUrl({ ...base, scope: "openid", nonce: "n_1" }))
      .searchParams;
    expect(q.get("scope")).toBe("openid");
    expect(q.get("nonce")).toBe("n_1");
  });
});

describe("base64UrlDecode", () => {
  it("round-trips with base64UrlEncode", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(Array.from(base64UrlDecode(base64UrlEncode(bytes)))).toEqual(Array.from(bytes));
  });

  it("decodes URL-safe base64 back to the original UTF-8 text", () => {
    const text = "สมชาย ใจดี"; // Thai — exercises multi-byte UTF-8
    const encoded = base64UrlEncode(new TextEncoder().encode(text));
    expect(new TextDecoder().decode(base64UrlDecode(encoded))).toBe(text);
  });
});

describe("decodeJwtClaims", () => {
  it("returns the payload claims of a well-formed JWT (unverified)", () => {
    const claims = {
      sub: "U1234567890abcdef",
      name: "สมชาย ใจดี",
      aud: "2010753164",
      iss: "https://access.line.me",
      exp: 9999999999,
    };
    expect(decodeJwtClaims(makeJwt(claims))).toEqual(claims);
  });

  it("returns null for malformed tokens", () => {
    expect(decodeJwtClaims("")).toBeNull();
    expect(decodeJwtClaims("not-a-jwt")).toBeNull();
    expect(decodeJwtClaims("a.b")).toBeNull(); // too few segments
    expect(decodeJwtClaims("a.%%%.c")).toBeNull(); // payload not valid base64/JSON
  });
});

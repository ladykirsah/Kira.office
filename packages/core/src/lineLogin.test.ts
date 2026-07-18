import { describe, it, expect } from "vitest";
import {
  base64UrlEncode,
  pkceChallengeS256,
  buildLineAuthorizeUrl,
  LINE_AUTHORIZE_URL,
} from "./lineLogin";

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

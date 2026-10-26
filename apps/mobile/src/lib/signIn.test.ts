import { describe, expect, it } from "vitest";
import { readSignInReply, signIn, signInRequest, type FetchFn } from "./signIn";

describe("signInRequest", () => {
  it("given each way in > goes to that door with only what the door needs", () => {
    expect(signInRequest({ kind: "pin", pin: "123456" })).toEqual({
      path: "/staff/login-pin",
      body: { pin: "123456" },
    });
    expect(signInRequest({ kind: "password", email: "a@b.co", password: "pw" })).toEqual({
      path: "/staff/login",
      body: { email: "a@b.co", password: "pw" },
    });
    expect(signInRequest({ kind: "key", key: "k-1" })).toEqual({
      path: "/staff/login-recovery",
      body: { key: "k-1" },
    });
    expect(signInRequest({ kind: "practice" })).toEqual({
      path: "/staff/login-practice",
      body: {},
    });
  });
});

describe("readSignInReply", () => {
  const staff = { userId: "u1", email: "a@b.co", name: "Lady", role: "super_admin" };

  it("given a 200 with a token > signs in as that person", () => {
    expect(readSignInReply(200, { token: "t-1", expiresAt: 1, staff })).toEqual({
      ok: true,
      token: "t-1",
      staff,
    });
  });

  it("given each refusal the server sends > names it, so the screen can say the right thing", () => {
    expect(readSignInReply(401, { error: "invalid", reason: "locked" })).toEqual({
      ok: false,
      failure: "locked",
    });
    expect(readSignInReply(401, { error: "invalid", reason: "needs_reset" })).toEqual({
      ok: false,
      failure: "needs_reset",
    });
    expect(readSignInReply(503, { error: "pin_login_unavailable" })).toEqual({
      ok: false,
      failure: "pin_login_unavailable",
    });
    expect(readSignInReply(429, {})).toEqual({ ok: false, failure: "too_many_attempts" });
    expect(readSignInReply(404, { error: "not found" })).toEqual({
      ok: false,
      failure: "not_available",
    });
    expect(readSignInReply(401, { error: "invalid", reason: "wrong_password" })).toEqual({
      ok: false,
      failure: "invalid",
    });
  });

  it("given a 200 without a usable token > treats it as a refusal, never as signed in", () => {
    expect(readSignInReply(200, { staff })).toEqual({ ok: false, failure: "invalid" });
    expect(readSignInReply(200, null)).toEqual({ ok: false, failure: "invalid" });
  });
});

describe("signIn", () => {
  it("given a PIN > posts it as JSON to the PIN door and returns the person", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn: FetchFn = async (url, init) => {
      calls.push({ url, init });
      return Response.json({
        token: "t-9",
        expiresAt: 1,
        staff: { userId: "u", email: "e@x.co", name: "N", role: "mechanic" },
      });
    };

    const result = await signIn(fetchFn, "http://localhost:8788", { kind: "pin", pin: "654321" });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://localhost:8788/staff/login-pin");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ pin: "654321" });
    expect(result).toMatchObject({ ok: true, token: "t-9", staff: { role: "mechanic" } });
  });

  it("given the server cannot be reached > says unreachable, not wrong PIN", async () => {
    const fetchFn: FetchFn = async () => {
      throw new TypeError("Network request failed");
    };

    const result = await signIn(fetchFn, "http://localhost:8788", { kind: "pin", pin: "111111" });

    expect(result).toEqual({ ok: false, failure: "unreachable" });
  });

  it("given a refusal whose body is not JSON > still names the refusal", async () => {
    const fetchFn: FetchFn = async () => new Response("Too Many Requests", { status: 429 });

    const result = await signIn(fetchFn, "http://x", { kind: "key", key: "k" });

    expect(result).toEqual({ ok: false, failure: "too_many_attempts" });
  });
});

import { describe, expect, it } from "vitest";
import type { FetchFn } from "./signIn";
import { currentStaff, signOut } from "./staffApi";

const staff = { userId: "u1", email: "a@b.co", name: "Lady", role: "admin" };

function recording(reply: () => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, init });
    return reply();
  };
  return { calls, fetchFn };
}

describe("currentStaff", () => {
  it("given a live session > asks the API with the session header and returns the person", async () => {
    const { calls, fetchFn } = recording(async () => Response.json({ staff }));

    const who = await currentStaff(fetchFn, "http://api", "tok-1");

    expect(who).toEqual(staff);
    expect(calls[0]?.url).toBe("http://api/staff/me");
    expect(calls[0]?.init.headers).toEqual({ "X-Staff-Session": "tok-1" });
  });

  it("given an expired session, a garbled reply or no network > nobody is signed in", async () => {
    const expired = recording(async () =>
      Response.json({ error: "unauthorized" }, { status: 401 }),
    );
    const garbled = recording(async () => Response.json({ staff: { name: "no role" } }));
    const offline = recording(async () => {
      throw new TypeError("Network request failed");
    });

    expect(await currentStaff(expired.fetchFn, "http://api", "t")).toBeNull();
    expect(await currentStaff(garbled.fetchFn, "http://api", "t")).toBeNull();
    expect(await currentStaff(offline.fetchFn, "http://api", "t")).toBeNull();
  });
});

describe("signOut", () => {
  it("given a session > tells the API to end it", async () => {
    const { calls, fetchFn } = recording(async () => Response.json({ ok: true }));

    await signOut(fetchFn, "http://api", "tok-2");

    expect(calls[0]?.url).toBe("http://api/staff/logout");
    expect(calls[0]?.init).toMatchObject({
      method: "POST",
      headers: { "X-Staff-Session": "tok-2" },
    });
  });

  it("given no network > still finishes, so the phone can forget the session anyway", async () => {
    const { fetchFn } = recording(async () => {
      throw new TypeError("Network request failed");
    });

    await expect(signOut(fetchFn, "http://api", "t")).resolves.toBeUndefined();
  });
});

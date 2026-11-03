import { describe, expect, it } from "vitest";
import { session } from "./scanApi";
import { addService, deleteService, updateService } from "./servicesApi";
import type { FetchFn } from "./signIn";

function replying(status: number, body: unknown) {
  const calls: { url: string; method: string; auth: string | null; body: unknown }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      auth: new Headers(init?.headers).get(Object.keys(session("x"))[0]!),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetchFn };
}

const BODY = { name: "ซ่อมพัดลม", nameEn: "", basePriceSatang: 0 };

describe("servicesApi", () => {
  it("addService > then POST /services with the body, behind the session, and gives the saved row", async () => {
    const row = { id: "sv9", ...BODY };
    const { calls, fetchFn } = replying(201, row);
    expect(await addService(fetchFn, "https://api", "tok", BODY)).toEqual(row);
    expect(calls).toEqual([
      { url: "https://api/services", method: "POST", auth: "tok", body: BODY },
    ]);
  });
  it("updateService > then PATCH /services/:id", async () => {
    const { calls, fetchFn } = replying(200, { ok: true });
    await updateService(fetchFn, "https://api", "tok", "sv 1", BODY);
    expect(calls[0]).toMatchObject({
      url: "https://api/services/sv%201",
      method: "PATCH",
      body: BODY,
    });
  });
  it("deleteService > then DELETE /services/:id", async () => {
    const { calls, fetchFn } = replying(200, { ok: true });
    await deleteService(fetchFn, "https://api", "tok", "sv1");
    expect(calls[0]).toMatchObject({ url: "https://api/services/sv1", method: "DELETE" });
  });
  it("given the server refuses > then each call throws, nothing is taken as saved", async () => {
    const { fetchFn } = replying(400, { error: "name is required" });
    await expect(addService(fetchFn, "https://api", "tok", BODY)).rejects.toThrow();
    await expect(updateService(fetchFn, "https://api", "tok", "sv1", BODY)).rejects.toThrow();
    await expect(deleteService(fetchFn, "https://api", "tok", "sv1")).rejects.toThrow();
  });
});

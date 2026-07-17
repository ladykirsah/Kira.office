import { describe, it, expect, vi, afterEach } from "vitest";
import { resolvePostcode, loadPostcodes, type PostcodeMap } from "./thaiGeo";

const MAP: PostcodeMap = {
  "81120": [
    ["คลองท่อมเหนือ", "คลองท่อม", "กระบี่"],
    ["คลองท่อมใต้", "คลองท่อม", "กระบี่"],
  ],
  // 10250 spans two อำเภอ (บางกะปิ + ประเวศ)
  "10250": [
    ["หัวหมาก", "บางกะปิ", "กรุงเทพมหานคร"],
    ["ประเวศ", "ประเวศ", "กรุงเทพมหานคร"],
  ],
};

describe("resolvePostcode", () => {
  it("given a known single-อำเภอ zip > returns tambons + guessed province/อำเภอ (first row)", () => {
    expect(resolvePostcode(MAP, "81120")).toEqual({
      province: "กระบี่",
      amphoe: "คลองท่อม",
      tambons: [
        { tambon: "คลองท่อมเหนือ", amphoe: "คลองท่อม", province: "กระบี่" },
        { tambon: "คลองท่อมใต้", amphoe: "คลองท่อม", province: "กระบี่" },
      ],
    });
  });

  it("given a multi-อำเภอ zip > lists every tambon with its own อำเภอ", () => {
    const r = resolvePostcode(MAP, "10250");
    expect(r?.tambons.map((t) => t.amphoe)).toEqual(["บางกะปิ", "ประเวศ"]);
  });

  it("given an unknown zip > returns null", () => {
    expect(resolvePostcode(MAP, "99999")).toBeNull();
  });
});

describe("loadPostcodes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("given a transient fetch failure > does not poison the cache; a later call retries and succeeds", async () => {
    const good: PostcodeMap = { "10250": [["หัวหมาก", "บางกะปิ", "กรุงเทพมหานคร"]] };
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw new Error("network");
        return { ok: true, json: async () => good } as unknown as Response;
      }),
    );
    // First attempt fails…
    await expect(loadPostcodes()).rejects.toThrow();
    // …and the NEXT attempt must re-fetch and resolve (the poisoned-cache bug returned the same
    // rejected promise here, breaking autofill for the whole session).
    await expect(loadPostcodes()).resolves.toEqual(good);
    expect(calls).toBe(2);
  });
});

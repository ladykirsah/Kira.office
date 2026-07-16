import { describe, it, expect } from "vitest";
import { resolvePostcode, type PostcodeMap } from "./thaiGeo";

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

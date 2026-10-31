import { describe, expect, it } from "vitest";
import { attrLabel, nameLabel, nameTaken, pickList } from "./productPickers";

const DENSO = { id: "b1", name: "DENSO", nameTh: null, nameEn: "DENSO" };
const COMP = { id: "t1", name: "Compressor", nameTh: "คอมเพรสเซอร์", nameEn: "Compressor" };

describe("attrLabel", () => {
  it("given Thai > then the Thai name, else the identity name", () => {
    expect(attrLabel(COMP)).toEqual({ th: "คอมเพรสเซอร์", en: "Compressor" });
    expect(attrLabel(DENSO)).toEqual({ th: "DENSO", en: "DENSO" });
  });
});

describe("nameTaken", () => {
  it("given a name already in the list, any case or spacing > then that one", () => {
    expect(nameTaken([DENSO, COMP], " denso ", "")).toBe(DENSO);
  });
  it("given a Thai name already in the list > then that one", () => {
    expect(nameTaken([DENSO, COMP], "Kompressor", "คอมเพรสเซอร์")).toBe(COMP);
  });
  it("given new names > then none", () => {
    expect(nameTaken([DENSO, COMP], "Bosch", "บ๊อช")).toBeNull();
  });
});

describe("pickList", () => {
  it("given a search > then rows whose Thai or English name holds it", () => {
    expect(pickList([DENSO, COMP], "คอม").map((a) => a.id)).toEqual(["t1"]);
    expect(pickList([DENSO, COMP], "comp").map((a) => a.id)).toEqual(["t1"]);
  });
  it("given nothing typed > then all, in the shop's own order (แอร์ first, as drawn)", () => {
    expect(pickList([COMP, DENSO], "").map((a) => a.id)).toEqual(["t1", "b1"]);
  });
});

describe("nameLabel", () => {
  it("given a product's brand, system or part name > then what people read for it", () => {
    expect(nameLabel([DENSO, COMP], "Compressor")).toEqual({
      th: "คอมเพรสเซอร์",
      en: "Compressor",
    });
  });
  it("given a name the lists no longer have > then the name itself", () => {
    expect(nameLabel([DENSO], "Bosch")).toEqual({ th: "Bosch", en: "Bosch" });
  });
  it("given none > then a dash", () => {
    expect(nameLabel([DENSO], null)).toEqual({ th: "—", en: "—" });
  });
});

import { describe, expect, it } from "vitest";
import {
  carLines,
  labelHeightMm,
  labelQr,
  labelText,
  LABEL_WIDTH_MM,
  MAX_CAR_LINES,
} from "./barcodeLabel";
import type { ProductRow } from "./productList";
import type { Attributes, CarBrand } from "./productsApi";

const BRANDS: CarBrand[] = [
  {
    id: "b1",
    name: "Toyota",
    nameTh: "โตโยต้า",
    nameEn: "Toyota",
    models: [
      { id: "m1", name: "Vigo", nameTh: "วีโก้", nameEn: "Vigo", yearFrom: null, yearTo: null },
      {
        id: "m2",
        name: "Fortuner",
        nameTh: "ฟอร์จูนเนอร์",
        nameEn: null,
        yearFrom: null,
        yearTo: null,
      },
      { id: "m3", name: "Innova", nameTh: null, nameEn: "Innova", yearFrom: null, yearTo: null },
    ],
  },
  {
    id: "b2",
    name: "Honda",
    nameTh: "ฮอนด้า",
    nameEn: "Honda",
    models: [
      { id: "m4", name: "Jazz", nameTh: "แจ๊ส", nameEn: null, yearFrom: null, yearTo: null },
    ],
  },
];

const fit = (
  carModel: string | null,
  yearFrom: number | null,
  yearTo: number | null,
  carBrand = "Toyota",
) => ({
  carBrand,
  carModel,
  yearFrom,
  yearTo,
});

describe("labelHeightMm", () => {
  it("given S with 5 car lines > then the picture's shape at 35 mm wide (46.5 mm)", () => {
    expect(LABEL_WIDTH_MM.S).toBe(35);
    expect(labelHeightMm("S", 5)).toBeCloseTo(46.53, 1);
  });

  it("given L with 5 car lines > then the same shape at 46 mm wide (61.2 mm)", () => {
    expect(LABEL_WIDTH_MM.L).toBe(46);
    expect(labelHeightMm("L", 5)).toBeCloseTo(61.15, 1);
  });

  it("given fewer car lines > then the label is cut shorter by the missing rows only", () => {
    expect(labelHeightMm("S", 1)).toBeCloseTo(35.17, 1);
    expect(labelHeightMm("L", 1)).toBeCloseTo(46.2, 1);
    expect(labelHeightMm("S", 3)).toBeLessThan(labelHeightMm("S", 4));
  });

  it("given no cars or more than five > then it stays between the 1-line and 5-line heights", () => {
    expect(labelHeightMm("S", 0)).toBe(labelHeightMm("S", 1));
    expect(labelHeightMm("S", 9)).toBe(labelHeightMm("S", MAX_CAR_LINES));
  });
});

describe("carLines", () => {
  it("given fitments > then each line is the model's Thai name and its years", () => {
    expect(carLines([fit("Vigo", 2005, 2014), fit("Fortuner", 2005, 2014)], BRANDS)).toEqual([
      { model: "วีโก้", years: "2005-2014" },
      { model: "ฟอร์จูนเนอร์", years: "2005-2014" },
    ]);
  });

  it("given a model with no Thai name yet > then its saved name, until someone adds the Thai one", () => {
    expect(carLines([fit("Innova", 2004, 2015)], BRANDS)).toEqual([
      { model: "Innova", years: "2004-2015" },
    ]);
  });

  it("given the same model name under two makes > then the make the fitment names decides", () => {
    const twins: CarBrand[] = [
      ...BRANDS,
      {
        id: "b3",
        name: "Suzuki",
        nameTh: "ซูซูกิ",
        nameEn: "Suzuki",
        models: [
          {
            id: "m9",
            name: "Vigo",
            nameTh: "วีโก้ซูซูกิ",
            nameEn: null,
            yearFrom: null,
            yearTo: null,
          },
        ],
      },
    ];
    expect(carLines([fit("Vigo", null, null, "Suzuki")], twins)[0]!.model).toBe("วีโก้ซูซูกิ");
  });

  it("given one year, the same year twice or none > then one year, one year, nothing", () => {
    expect(carLines([fit("Vigo", 2010, null)], BRANDS)[0]!.years).toBe("2010");
    expect(carLines([fit("Vigo", null, 2012)], BRANDS)[0]!.years).toBe("2012");
    expect(carLines([fit("Vigo", 2014, 2014)], BRANDS)[0]!.years).toBe("2014");
    expect(carLines([fit("Vigo", null, null)], BRANDS)[0]!.years).toBe("");
  });

  it("given a fitment for a whole make > then the make's Thai name", () => {
    expect(carLines([fit(null, 2008, 2013, "Honda")], BRANDS)).toEqual([
      { model: "ฮอนด้า", years: "2008-2013" },
    ]);
  });

  it("given more than five cars > then the first five only, with no 'and N more' line", () => {
    const many = ["Vigo", "Fortuner", "Innova", "Vigo", "Fortuner", "Innova", "Vigo"].map((m) =>
      fit(m, 2005, 2014),
    );
    expect(carLines(many, BRANDS)).toHaveLength(MAX_CAR_LINES);
  });

  it("given a fitment with neither make nor model > then it is left out", () => {
    expect(carLines([fit(null, 2005, 2014, null as unknown as string)], BRANDS)).toEqual([]);
  });
});

const ATTRS: Attributes = {
  brands: [{ id: "x", name: "DENSO", nameTh: "เด็นโซ่", nameEn: "Denso" }],
  usages: [],
  types: [{ id: "t", name: "คอมเพรสเซอร์", nameTh: null, nameEn: "Compressor" }],
};

const ROW = {
  productRef: "DN-447220",
  name: "คอมเพรสเซอร์ DENSO 10S11C",
  brandName: "DENSO",
  typeName: "คอมเพรสเซอร์",
  fitments: [fit("Vigo", 2005, 2014)],
} as unknown as ProductRow;

describe("labelText", () => {
  it("given a product > then its kind in Thai, its brand in English, its code and its cars", () => {
    expect(labelText(ROW, ATTRS, BRANDS)).toEqual({
      kind: "คอมเพรสเซอร์",
      brand: "Denso",
      code: "DN-447220",
      cars: [{ model: "วีโก้", years: "2005-2014" }],
    });
  });

  it("given a brand with no English name > then the brand as saved", () => {
    const attrs = { ...ATTRS, brands: [{ id: "x", name: "DENSO", nameTh: null, nameEn: null }] };
    expect(labelText(ROW, attrs, BRANDS).brand).toBe("DENSO");
  });

  it("given a part kind with a Thai name > then that Thai name", () => {
    const attrs = {
      ...ATTRS,
      types: [{ id: "t", name: "Compressor", nameTh: "คอมเพรสเซอร์", nameEn: "Compressor" }],
    };
    expect(labelText({ ...ROW, typeName: "Compressor" }, attrs, BRANDS).kind).toBe("คอมเพรสเซอร์");
  });

  it("given a product with no kind or brand > then the product name stands in, nothing invented", () => {
    const bare = { ...ROW, typeName: null, brandName: null } as ProductRow;
    expect(labelText(bare, ATTRS, BRANDS)).toMatchObject({
      kind: "คอมเพรสเซอร์ DENSO 10S11C",
      brand: "",
    });
  });
});

describe("labelQr", () => {
  it("given a product code > then a 21-square QR (the smallest), so it stays easy to scan on a small label", () => {
    const grid = labelQr("DN-447220");
    expect(grid).toHaveLength(21);
    expect(grid.every((row) => row.length === 21)).toBe(true);
  });

  it("given a 15-letter code > then still the smallest QR", () => {
    expect(labelQr("TG447610-72904D")).toHaveLength(21);
  });

  it("given a code with small letters > then a QR of exactly that code (a bigger one if it must be)", () => {
    expect(labelQr("dn-447220").length).toBeGreaterThanOrEqual(21);
  });

  it("given two codes > then two different QRs", () => {
    expect(labelQr("DN-447220")).not.toEqual(labelQr("DN-116340"));
  });
});

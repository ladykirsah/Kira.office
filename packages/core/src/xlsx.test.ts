import { describe, it, expect } from "vitest";
import {
  decodeXmlEntities,
  colToIndex,
  parseSharedStrings,
  parseSheet,
  escapeCsvField,
  shopeeSheetToImportCsv,
  xlsxToImportCsv,
} from "./xlsx";

/** Build a minimal STORED (method 0) ZIP — enough structure for unzip()'s central-directory walk. */
function makeStoredZip(entries: [name: string, content: string][]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: number[] = [];
  const central: number[] = [];
  const u16le = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
  for (const [name, content] of entries) {
    const nameB = [...enc.encode(name)];
    const dataB = [...enc.encode(content)];
    const localOffset = chunks.length;
    // local header: sig, version, flags, method=0, time, date, crc=0, sizes, nameLen, extraLen
    chunks.push(
      0x50,
      0x4b,
      0x03,
      0x04,
      ...u16le(20),
      ...u16le(0),
      ...u16le(0),
      ...u16le(0),
      ...u16le(0),
      ...u32le(0),
      ...u32le(dataB.length),
      ...u32le(dataB.length),
      ...u16le(nameB.length),
      ...u16le(0),
      ...nameB,
      ...dataB,
    );
    central.push(
      0x50,
      0x4b,
      0x01,
      0x02,
      ...u16le(20),
      ...u16le(20),
      ...u16le(0),
      ...u16le(0),
      ...u16le(0),
      ...u16le(0),
      ...u32le(0),
      ...u32le(dataB.length),
      ...u32le(dataB.length),
      ...u16le(nameB.length),
      ...u16le(0),
      ...u16le(0),
      ...u16le(0),
      ...u16le(0),
      ...u32le(0),
      ...u32le(localOffset),
      ...nameB,
    );
  }
  const cdOffset = chunks.length;
  chunks.push(...central);
  chunks.push(
    0x50,
    0x4b,
    0x05,
    0x06,
    ...u16le(0),
    ...u16le(0),
    ...u16le(entries.length),
    ...u16le(entries.length),
    ...u32le(central.length),
    ...u32le(cdOffset),
    ...u16le(0),
  );
  return new Uint8Array(chunks);
}

describe("decodeXmlEntities", () => {
  it("decodes the predefined entities and numeric refs", () => {
    expect(decodeXmlEntities("&lt;a&gt; &amp; &quot;b&quot; &apos;c&apos; &#48;&#x41;")).toBe(
      `<a> & "b" 'c' 0A`,
    );
  });
  it("leaves plain (incl. Thai) text untouched", () => {
    expect(decodeXmlEntities("สำเร็จแล้ว")).toBe("สำเร็จแล้ว");
  });
});

describe("colToIndex", () => {
  it("maps A1-style refs to 0-based column indices", () => {
    expect(colToIndex("A1")).toBe(0);
    expect(colToIndex("B2")).toBe(1);
    expect(colToIndex("Z9")).toBe(25);
    expect(colToIndex("AA1")).toBe(26);
    expect(colToIndex("AO2")).toBe(40);
  });
});

describe("parseSharedStrings", () => {
  it("returns entries in order, decoding entities and joining rich-text runs", () => {
    const xml =
      `<sst><si><t>id</t></si><si><t>A &amp; B</t></si>` +
      `<si><r><t>Rich </t></r><r><t>Txt</t></r></si>` +
      `<si><t xml:space="preserve"> pad</t></si></sst>`;
    expect(parseSharedStrings(xml)).toEqual(["id", "A & B", "Rich Txt", " pad"]);
  });
});

describe("parseSheet", () => {
  it("places cells by column ref, resolves shared/inline/plain, pads sparse rows", () => {
    const shared = ["ord", "สำเร็จ", "u1"];
    const xml =
      `<worksheet><sheetData>` +
      `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>1650.00</v></c></row>` +
      `<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c><c r="C2"><v>105.00</v></c></row>` +
      `<row r="3"><c r="A3" t="inlineStr"><is><t>inline</t></is></c><c r="B3"/></row>` +
      `</sheetData></worksheet>`;
    expect(parseSheet(xml, shared)).toEqual([
      ["ord", "", "1650.00"],
      ["ord", "สำเร็จ", "105.00"],
      ["inline", "", ""],
    ]);
  });
});

describe("escapeCsvField", () => {
  it("quotes only when needed and doubles inner quotes", () => {
    expect(escapeCsvField("plain")).toBe("plain");
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""');
    expect(escapeCsvField("line\nbreak")).toBe('"line\nbreak"');
  });
});

describe("shopeeSheetToImportCsv", () => {
  const header = [
    "หมายเลขคำสั่งซื้อ",
    "สถานะการสั่งซื้อ",
    "ชื่อผู้ใช้ (ผู้ซื้อ)",
    "วันที่ทำการสั่งซื้อ",
    "ค่าธรรมเนียม (%)",
    "เวลาส่งสินค้า",
    "ค่าคอมมิชชั่น",
    "Transaction Fee",
    "ค่าบริการ",
    "ราคาสินค้าที่ชำระโดยผู้ซื้อ (Total)",
  ];

  it("maps Thai headers to fields, sums fees, and dedupes multi-item orders", () => {
    const rows = [
      header,
      [
        "O1",
        "สำเร็จแล้ว",
        "buyer1",
        "2026-06-23 13:49",
        "3.21%",
        "2026-06-23 15:20",
        "185.00",
        "56.00",
        "141.00",
        "1450.00",
      ],
      // second item row of the SAME order → deduped away
      [
        "O1",
        "สำเร็จแล้ว",
        "buyer1",
        "2026-06-23 13:49",
        "3.21%",
        "2026-06-23 15:20",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
      ],
      [
        "O2",
        "ยกเลิกแล้ว",
        "buyer2",
        "2026-06-24 10:00",
        "3.21%",
        "",
        "10.00",
        "5.00",
        "3.00",
        "500.00",
      ],
    ];
    const csv = shopeeSheetToImportCsv(rows);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "external_order_id,order_status,buyer_username,order_date,ship_date,sales_total,order_fee,fee_pct",
    );
    expect(lines[1]).toBe(
      "O1,สำเร็จแล้ว,buyer1,2026-06-23 13:49,2026-06-23 15:20,1450.00,382.00,3.21%",
    );
    expect(lines[2]).toBe("O2,ยกเลิกแล้ว,buyer2,2026-06-24 10:00,,500.00,18.00,3.21%");
    expect(lines).toHaveLength(3); // header + 2 unique orders
  });

  it("throws a clear error when the order-number column is missing", () => {
    expect(() => shopeeSheetToImportCsv([["something else"], ["x"]])).toThrow(/order number/i);
  });

  it("throws when an expected money column is missing (avoids silently importing zeros)", () => {
    // A Shopee header rename would make find() miss the Sales column → every order Sales = 0.
    const noSales = header.filter((h) => !h.includes("ราคาสินค้าที่ชำระโดยผู้ซื้อ"));
    expect(() => shopeeSheetToImportCsv([noSales, ["x"]])).toThrow(/money column|ราคาสินค้า/i);
  });
});

describe("xlsxToImportCsv (full pipeline over a crafted archive)", () => {
  const headerXml = (cells: string[], rowN: number) =>
    cells
      .map(
        (v, i) =>
          `<c r="${String.fromCharCode(65 + i)}${rowN}" t="inlineStr"><is><t>${v}</t></is></c>`,
      )
      .join("");

  it("throws a clear error for a non-zip file", async () => {
    await expect(xlsxToImportCsv(new TextEncoder().encode("definitely not a zip"))).rejects.toThrow(
      /not a valid \.xlsx/,
    );
  });

  it("throws when the archive has no worksheet", async () => {
    const zip = makeStoredZip([["hello.txt", "hi"]]);
    await expect(xlsxToImportCsv(zip)).rejects.toThrow(/no worksheet/);
  });

  it("round-trips a stored-zip worksheet into the normalized import CSV", async () => {
    const headers = [
      "หมายเลขคำสั่งซื้อ",
      "สถานะการสั่งซื้อ",
      "ชื่อผู้ใช้ (ผู้ซื้อ)",
      "วันที่ทำการสั่งซื้อ",
      "ค่าธรรมเนียม (%)",
      "เวลาส่งสินค้า",
      "ค่าคอมมิชชั่น",
      "Transaction Fee",
      "ค่าบริการ",
      "ราคาสินค้าที่ชำระโดยผู้ซื้อ (Total)",
    ];
    const row = [
      "ZIP001",
      "สำเร็จแล้ว",
      "zipbuyer",
      "2026-06-23 13:49",
      "3.21%",
      "2026-06-23 15:20",
      "100.00",
      "50.00",
      "30.00",
      "900.00",
    ];
    const sheet =
      `<worksheet><sheetData><row r="1">${headerXml(headers, 1)}</row>` +
      `<row r="2">${headerXml(row, 2)}</row></sheetData></worksheet>`;
    const zip = makeStoredZip([["xl/worksheets/sheet1.xml", sheet]]);
    const csv = await xlsxToImportCsv(zip);
    expect(csv.trim().split("\n")[1]).toBe(
      "ZIP001,สำเร็จแล้ว,zipbuyer,2026-06-23 13:49,2026-06-23 15:20,900.00,180.00,3.21%",
    );
  });
});

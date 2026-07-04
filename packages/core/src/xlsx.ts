/**
 * Minimal, dependency-free .xlsx reader for the Shopee "completed orders" export.
 *
 * Shopee stores EVERY cell as text (dates "2026-06-23 13:49", money "1650.00", fee "3.21%") — no
 * numeric/date serials — so we only need: unzip (native DecompressionStream) → read sharedStrings +
 * the primary worksheet XML → resolve cells → normalize into the CSV the order importer already
 * understands. The XML/CSV functions are pure and unit-tested; the unzip glue is verified in the
 * browser / against the real export (jsdom has no zip support).
 */

/** Decode the five XML predefined entities plus decimal/hex numeric character references. */
export function decodeXmlEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    switch (e) {
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "amp":
        return "&";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default:
        return m;
    }
  });
}

/** An A1-style cell/column ref ("AO2" or "AO") → 0-based column index. */
export function colToIndex(ref: string): number {
  const letters = /^[A-Za-z]+/.exec(ref)?.[0] ?? "";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  return n - 1;
}

/** Parse xl/sharedStrings.xml into the ordered shared-string table (rich-text runs concatenated). */
export function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*\/>|<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const inner = m[1];
    if (inner === undefined) {
      out.push("");
      continue;
    }
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;
    let s = "";
    while ((t = tRe.exec(inner))) s += t[1];
    out.push(decodeXmlEntities(s));
  }
  return out;
}

/** Parse a worksheet XML into a dense 2-D grid of cell text; sparse/omitted cells become "". */
export function parseSheet(xml: string, shared: string[]): string[][] {
  const rowsRaw: Array<Array<{ i: number; v: string }>> = [];
  let maxCol = -1;
  const rowRe = /<row\b[^>]*\/>|<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml))) {
    const cells: Array<{ i: number; v: string }> = [];
    const inner = rm[1];
    if (inner !== undefined) {
      const cellRe = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(inner))) {
        const attrs = cm[1] ?? cm[2] ?? "";
        const body = cm[3]; // undefined for a self-closing empty cell
        const ref = /\br="([A-Za-z]+\d+)"/.exec(attrs)?.[1];
        if (!ref) continue;
        const col = colToIndex(ref);
        const t = /\bt="([^"]+)"/.exec(attrs)?.[1];
        let value = "";
        if (body !== undefined) {
          if (t === "inlineStr") {
            const isRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
            let it: RegExpExecArray | null;
            while ((it = isRe.exec(body))) value += it[1];
            value = decodeXmlEntities(value);
          } else {
            const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];
            if (v !== undefined) {
              value = t === "s" ? (shared[parseInt(v, 10)] ?? "") : decodeXmlEntities(v);
            }
          }
        }
        cells.push({ i: col, v: value });
        if (col > maxCol) maxCol = col;
      }
    }
    rowsRaw.push(cells);
  }
  return rowsRaw.map((cells) => {
    const arr = new Array<string>(maxCol + 1).fill("");
    for (const c of cells) arr[c.i] = c.v;
    return arr;
  });
}

/** RFC-4180-escape one field (quote when it holds a comma, quote, or newline; double inner quotes). */
export function escapeCsvField(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Distinctive substrings of the Shopee "completed orders" export headers (Thai), matched by includes.
const SHOPEE_HEADERS = {
  external_order_id: "หมายเลขคำสั่งซื้อ",
  order_status: "สถานะการสั่งซื้อ",
  buyer_username: "ชื่อผู้ใช้",
  order_date: "วันที่ทำการสั่งซื้อ",
  fee_pct: "ค่าธรรมเนียม",
  ship_date: "เวลาส่งสินค้า",
  commission: "ค่าคอมมิชชั่น",
  transaction: "Transaction Fee",
  service: "ค่าบริการ",
  sales_total: "ราคาสินค้าที่ชำระโดยผู้ซื้อ",
} as const;

const OUT_FIELDS = [
  "external_order_id",
  "order_status",
  "buyer_username",
  "order_date",
  "ship_date",
  "sales_total",
  "order_fee",
  "fee_pct",
] as const;

/** Tolerant number parse for the text money cells ("1,450.00" / "185.00" / ""); non-numbers → 0. */
function num(s: string | undefined): number {
  const n = parseFloat((s ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Turn a raw Shopee completed-orders sheet (Thai headers) into a normalized CSV whose header row uses
 * the importer's field names: sums the three fee columns (commission + transaction + service) into
 * order_fee, carries sales_total/fee_pct/dates/username, and dedupes multi-item orders to one row.
 */
export function shopeeSheetToImportCsv(rows: string[][]): string {
  const header = rows[0];
  if (!header) throw new Error("empty sheet");
  const find = (sub: string) => header.findIndex((h) => (h ?? "").includes(sub));
  const idx = {
    external_order_id: find(SHOPEE_HEADERS.external_order_id),
    order_status: find(SHOPEE_HEADERS.order_status),
    buyer_username: find(SHOPEE_HEADERS.buyer_username),
    order_date: find(SHOPEE_HEADERS.order_date),
    fee_pct: find(SHOPEE_HEADERS.fee_pct),
    ship_date: find(SHOPEE_HEADERS.ship_date),
    commission: find(SHOPEE_HEADERS.commission),
    transaction: find(SHOPEE_HEADERS.transaction),
    service: find(SHOPEE_HEADERS.service),
    sales_total: find(SHOPEE_HEADERS.sales_total),
  };
  if (idx.external_order_id < 0) {
    throw new Error("could not find the Shopee order number column (หมายเลขคำสั่งซื้อ)");
  }
  const cell = (row: string[], i: number): string => (i >= 0 && row[i] != null ? row[i]! : "");

  const seen = new Set<string>();
  const lines: string[] = [OUT_FIELDS.join(",")];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const id = cell(row, idx.external_order_id).trim();
    if (!id || seen.has(id)) continue; // multi-item orders repeat the order number
    seen.add(id);
    const fee =
      num(cell(row, idx.commission)) +
      num(cell(row, idx.transaction)) +
      num(cell(row, idx.service));
    lines.push(
      [
        id,
        cell(row, idx.order_status),
        cell(row, idx.buyer_username),
        cell(row, idx.order_date),
        cell(row, idx.ship_date),
        cell(row, idx.sales_total),
        fee.toFixed(2),
        cell(row, idx.fee_pct),
      ]
        .map(escapeCsvField)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

// ── unzip glue (native DecompressionStream; verified against the real export, not unit-tested) ──

const u16 = (b: Uint8Array, o: number) => (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8);
const u32 = (b: Uint8Array, o: number) =>
  ((b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) | ((b[o + 2] ?? 0) << 16) | ((b[o + 3] ?? 0) << 24)) >>> 0;

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  // Copy into a fresh ArrayBuffer-backed view so the chunk type is a plain BufferSource.
  void writer.write(new Uint8Array(bytes));
  void writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array);
    total += (value as Uint8Array).length;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Read a ZIP archive's entries into name → uncompressed bytes (via the central directory). */
async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  let eocd = -1;
  const min = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a valid .xlsx file (no ZIP end-of-directory record)");
  const count = u16(bytes, eocd + 10);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  let p = u32(bytes, eocd + 16);
  for (let n = 0; n < count; n++) {
    if (u32(bytes, p) !== 0x02014b50) break;
    const method = u16(bytes, p + 10);
    const compSize = u32(bytes, p + 20);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const localOff = u32(bytes, p + 42);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const dataStart = localOff + 30 + u16(bytes, localOff + 26) + u16(bytes, localOff + 28);
    const comp = bytes.subarray(dataStart, dataStart + compSize);
    out.set(name, method === 0 ? comp : await inflateRaw(comp));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Resolve the workbook's first worksheet part (falls back to the lowest-numbered sheet). */
function primaryWorksheet(files: Map<string, Uint8Array>): string {
  const dec = new TextDecoder();
  const wb = files.get("xl/workbook.xml");
  const rels = files.get("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(dec.decode(wb))?.[1];
    if (rid) {
      const relsXml = dec.decode(rels);
      const target =
        new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*\\bTarget="([^"]+)"`).exec(
          relsXml,
        )?.[1] ??
        new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${rid}"`).exec(
          relsXml,
        )?.[1];
      if (target) {
        const t = target.replace(/^\//, "");
        const full = t.startsWith("xl/") ? t : `xl/${t}`;
        if (files.has(full)) return full;
      }
    }
  }
  const sheets = [...files.keys()]
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(/(\d+)/.exec(a)?.[1] ?? 0) - Number(/(\d+)/.exec(b)?.[1] ?? 0));
  const first = sheets[0];
  if (!first) throw new Error("no worksheet found in the .xlsx file");
  return first;
}

/** Full pipeline: raw .xlsx bytes → normalized Shopee import CSV. */
export async function xlsxToImportCsv(bytes: Uint8Array): Promise<string> {
  const files = await unzip(bytes);
  const dec = new TextDecoder();
  const read = (name: string) => {
    const d = files.get(name);
    return d ? dec.decode(d) : "";
  };
  const shared = parseSharedStrings(read("xl/sharedStrings.xml"));
  const rows = parseSheet(read(primaryWorksheet(files)), shared);
  return shopeeSheetToImportCsv(rows);
}

/**
 * Customers Excel import — header auto-detection.
 * The shop's legacy customer list is a hand-made Excel with Thai (or mixed) headers; this guesses
 * which column holds which customers field so the mapping UI starts pre-filled. The guess is only
 * a default — the user can correct every field in the UI before importing.
 */

export interface CustomerImportField {
  field: string;
  label: string;
}

/** The importable customers fields, in display order (plate first — it is the key). */
export const CUSTOMER_IMPORT_FIELDS: CustomerImportField[] = [
  { field: "license_plate", label: "License plate" },
  { field: "plate_province", label: "Province" },
  { field: "customer_name", label: "Name" },
  { field: "phone", label: "Phone" },
  { field: "car_model", label: "Car model" },
  { field: "notes", label: "Notes" },
];

// Claiming priority differs from display order: fields with the loosest synonyms go last so a
// header like "Customer Phone" is claimed by phone, not customer_name ("ชื่อรุ่น" by car_model, etc.).
const SYNONYMS: [field: string, synonyms: string[]][] = [
  ["license_plate", ["ทะเบียน", "plate", "license"]],
  ["phone", ["เบอร์", "โทร", "phone", "tel", "mobile", "มือถือ"]],
  ["plate_province", ["จังหวัด", "province"]],
  ["notes", ["หมายเหตุ", "note", "memo", "remark"]],
  ["car_model", ["รุ่น", "model", "ยี่ห้อ", "brand"]],
  ["customer_name", ["ชื่อ", "name", "customer", "ลูกค้า"]],
];

/**
 * Guess a mapRows-shaped field→header mapping from a sheet's header row. Each header is claimed by
 * at most one field. A header that STARTS WITH a synonym beats one that merely contains it, so the
 * pure "ทะเบียน" column wins the plate over "จังหวัดที่จดทะเบียน" regardless of column order.
 */
function guessMapping(
  headers: string[],
  fieldSynonyms: [field: string, synonyms: string[]][],
): Record<string, string> {
  const normalized = headers.map((h) => (h ?? "").trim().toLowerCase());
  const claimed = new Set<number>();
  const mapping: Record<string, string> = {};
  for (const [field, synonyms] of fieldSynonyms) {
    const free = (i: number) => !claimed.has(i) && normalized[i] !== "";
    const starts = normalized.findIndex((h, i) => free(i) && synonyms.some((s) => h.startsWith(s)));
    const contains = normalized.findIndex((h, i) => free(i) && synonyms.some((s) => h.includes(s)));
    const index = starts !== -1 ? starts : contains;
    if (index !== -1) {
      claimed.add(index);
      mapping[field] = headers[index] ?? "";
    }
  }
  return mapping;
}

export function guessCustomerMapping(headers: string[]): Record<string, string> {
  return guessMapping(headers, SYNONYMS);
}

/** The history-import fields (one row per legacy bill), in display order. */
export const CUSTOMER_HISTORY_FIELDS: CustomerImportField[] = [
  { field: "license_plate", label: "License plate" },
  { field: "happened_at", label: "Date" },
  { field: "description", label: "Work / items" },
];

const HISTORY_SYNONYMS: [field: string, synonyms: string[]][] = [
  ["license_plate", ["ทะเบียน", "plate", "license"]],
  ["happened_at", ["วันที่", "วัน", "date"]],
  ["description", ["รายการ", "รายละเอียด", "งาน", "description", "items", "work", "detail"]],
];

export function guessHistoryMapping(headers: string[]): Record<string, string> {
  return guessMapping(headers, HISTORY_SYNONYMS);
}

/**
 * Shape detection so ONE Import button accepts both template tabs: a sheet whose headers carry a
 * date and a work-description column is the service-history tab, not the customer directory.
 */
export function looksLikeHistorySheet(headers: string[]): boolean {
  const mapping = guessHistoryMapping(headers);
  return mapping["happened_at"] != null && mapping["description"] != null;
}

export interface CombinedRowError {
  rowIndex: number;
  reason: string;
}
type RowError = CombinedRowError;

export interface CombinedSplit {
  customers: string[][];
  history: string[][];
  /** Sheet data-row number (1-based) for each generated history row, for error mapping. */
  historySourceRows: number[];
  errors: CombinedRowError[];
}

/**
 * A transcription sheet: BOTH history columns (date + work) AND real customer-info columns.
 * One block per car — info on the first line, history lines under it, blank plate = same car.
 */
export function looksLikeCombinedSheet(headers: string[]): boolean {
  const hist = guessHistoryMapping(headers);
  const cust = guessCustomerMapping(headers);
  const infoCount = ["plate_province", "customer_name", "phone", "car_model"].filter(
    (f) => cust[f] != null,
  ).length;
  return hist["happened_at"] != null && hist["description"] != null && infoCount >= 2;
}

const CUSTOMER_OUT_HEADER = ["ทะเบียน", "จังหวัด", "ชื่อลูกค้า", "เบอร์โทร", "รุ่นรถ", "หมายเหตุ"];
const HISTORY_OUT_HEADER = ["ทะเบียน", "วันที่", "รายการ"];
const INFO_FIELDS = ["plate_province", "customer_name", "phone", "car_model", "notes"] as const;

/**
 * Split a combined transcription sheet into the two import shapes. Plate forward-fills down the
 * block (a blank ทะเบียน row belongs to the car above); customer info scattered across a block is
 * merged first-non-empty-wins; every generated history row remembers its SHEET row number so
 * server-side errors (e.g. unreadable dates) can point at the row the user actually typed.
 */
export function splitCombinedSheet(rows: string[][]): CombinedSplit {
  const header = rows[0] ?? [];
  const cust = guessCustomerMapping(header);
  const hist = guessHistoryMapping(header);
  const col = (h?: string) => (h == null ? -1 : header.indexOf(h));
  const plateCol = col(cust["license_plate"] ?? hist["license_plate"]);
  const infoCols = INFO_FIELDS.map((f) => col(cust[f]));
  const dateCol = col(hist["happened_at"]);
  const itemsCol = col(hist["description"]);
  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

  const errors: RowError[] = [];
  const order: string[] = [];
  const info = new Map<string, string[]>();
  const history: string[][] = [HISTORY_OUT_HEADER.slice()];
  const historySourceRows: number[] = [];
  let current = "";

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const plate = cell(row, plateCol);
    if (plate) {
      current = plate;
      if (!info.has(plate)) {
        info.set(plate, ["", "", "", "", ""]);
        order.push(plate);
      }
    }
    const infoValues = infoCols.map((c) => cell(row, c));
    const date = cell(row, dateCol);
    const items = cell(row, itemsCol);
    const hasAnything = plate || date || items || infoValues.some((v) => v !== "");
    if (!hasAnything) continue; // fully blank spacer row

    if (!current) {
      errors.push({ rowIndex: i, reason: "ไม่มีทะเบียน — no car above this row yet" });
      continue;
    }
    const merged = info.get(current)!;
    for (let f = 0; f < infoValues.length; f++) {
      if (infoValues[f] !== "" && merged[f] === "") merged[f] = infoValues[f]!;
    }
    if (date || items) {
      if (!date) {
        errors.push({ rowIndex: i, reason: "missing วันที่ for this รายการ line" });
      } else if (!items) {
        errors.push({ rowIndex: i, reason: "missing รายการ for this วันที่ line" });
      } else {
        history.push([current, date, items]);
        historySourceRows.push(i);
      }
    }
  }

  const customers: string[][] = [
    CUSTOMER_OUT_HEADER.slice(),
    ...order.map((p) => [p, ...info.get(p)!]),
  ];
  return { customers, history, historySourceRows, errors };
}

// ── Rich grouped transcription form ──────────────────────────────────────────────────────────
// The owner's real form: a two-row header — a colour GROUP row (ทะเบียน · รถยนต์ · ลูกค้า · ประวัติ)
// over a FIELD row — behind an optional title/spacer preamble, then one visit date with many
// line-items beneath it. Read by GROUP because a field name (หมายเหตุ) repeats across groups.

type RichRole =
  | "plate"
  | "province"
  | "car_brand"
  | "car_model_name"
  | "car_year"
  | "cust_name"
  | "phone"
  | "cust_note"
  | "date"
  | "item"
  | "prod_brand"
  | "prod_code"
  | "hist_note";

/** Locate the (group row, field row) of the grouped form — the group row carries both ทะเบียน + ประวัติ. */
function findRichHeader(rows: string[][]): { groupRow: number; fieldRow: number } | null {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const has = (label: string) => r.some((c) => (c ?? "").trim() === label);
    if (has("ทะเบียน") && has("ประวัติ") && i + 1 < rows.length) {
      return { groupRow: i, fieldRow: i + 1 };
    }
  }
  return null;
}

export function looksLikeRichSheet(rows: string[][]): boolean {
  return findRichHeader(rows) != null;
}

/**
 * Classify a column by its (forward-filled group, field). Group context disambiguates the field
 * name หมายเหตุ, which appears in both the customer and history groups. EVERY role matches an
 * explicit field keyword — an unrecognised or blank column maps to null (ignored), never silently
 * claiming a role, so a stray empty column inside a group can't steal the รายการ / plate / etc.
 */
function richRole(group: string, field: string): RichRole | null {
  const g = group;
  const f = field;
  if (g.includes("ทะเบียน")) {
    if (f.includes("จังหวัด")) return "province";
    if (f.includes("ตัวอักษร") || f.includes("ทะเบียน") || f.includes("เลข")) return "plate";
    return null;
  }
  if (g.includes("รถยนต์")) {
    if (f.includes("รุ่น")) return "car_model_name";
    if (f.includes("ปี")) return "car_year";
    if (f.includes("แบรนด์") || f.includes("ยี่ห้อ")) return "car_brand";
    return null;
  }
  if (g.includes("ลูกค้า")) {
    if (f.includes("ชื่อ")) return "cust_name";
    if (f.includes("เบอร์") || f.includes("โทร")) return "phone";
    if (f.includes("หมายเหตุ")) return "cust_note";
    return null;
  }
  if (g.includes("ประวัติ")) {
    if (f.includes("วัน")) return "date";
    if (f.includes("แบรนด์")) return "prod_brand";
    if (f.includes("รหัส")) return "prod_code";
    if (f.includes("รายการ") || f.includes("รายละเอียด") || f.includes("งาน")) return "item";
    if (f.includes("หมายเหตุ")) return "hist_note";
    return null;
  }
  return null;
}

/** One legacy line item folded to text: "รายการ (brand · code) — note" (blank parts drop out). */
function formatRichLineItem(item: string, brand: string, code: string, note: string): string {
  let s = item;
  const extras = [brand, code].filter(Boolean).join(" · ");
  if (extras) s += ` (${extras})`;
  if (note) s += ` — ${note}`;
  return s;
}

/**
 * Parse the grouped bill-style transcription form into the two import shapes. One block per car
 * (blank ทะเบียน = same car); within a block a visit date owns every line-item beneath it (blank
 * วันที่ = same visit), and the items fold into ONE history entry so the timeline shows a visit
 * the way a Kira bill does. Car brand/รุ่น/ปี combine into the model; multiple phones join.
 */
export function parseRichSheet(rows: string[][]): CombinedSplit {
  const head = findRichHeader(rows);
  if (!head) return { customers: [], history: [], historySourceRows: [], errors: [] };

  const groupRaw = rows[head.groupRow] ?? [];
  const fieldRaw = rows[head.fieldRow] ?? [];
  const width = Math.max(groupRaw.length, fieldRaw.length);
  // Forward-fill the group label across its columns (only the first column of a merged group
  // carries the label in CSV).
  const roleOf: (RichRole | null)[] = [];
  let group = "";
  for (let c = 0; c < width; c++) {
    const gcell = (groupRaw[c] ?? "").trim();
    if (gcell) group = gcell;
    roleOf[c] = richRole(group, (fieldRaw[c] ?? "").trim());
  }
  const colFor = (role: RichRole) => roleOf.findIndex((r) => r === role);
  const cols = {
    plate: colFor("plate"),
    province: colFor("province"),
    car_brand: colFor("car_brand"),
    car_model_name: colFor("car_model_name"),
    car_year: colFor("car_year"),
    cust_name: colFor("cust_name"),
    phone: colFor("phone"),
    cust_note: colFor("cust_note"),
    date: colFor("date"),
    item: colFor("item"),
    prod_brand: colFor("prod_brand"),
    prod_code: colFor("prod_code"),
    hist_note: colFor("hist_note"),
  } as Record<RichRole, number>;
  const cell = (row: string[], role: RichRole) => {
    const c = cols[role];
    return c >= 0 ? (row[c] ?? "").trim() : "";
  };

  interface Cust {
    province: string;
    name: string;
    phones: string[];
    note: string;
    brand: string;
    model: string;
    year: string;
  }
  interface Visit {
    plate: string;
    date: string;
    items: string[];
    sourceRow: number;
  }
  const order: string[] = [];
  const custs = new Map<string, Cust>();
  const visitOrder: string[] = [];
  const visits = new Map<string, Visit>();
  const errors: RowError[] = [];
  let currentPlate = "";
  let currentDate = "";
  let currentDateRow = 0;

  for (let i = head.fieldRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const sheetRow = i + 1; // spreadsheet row numbers are 1-based and include every preamble row
    const plate = cell(row, "plate");
    if (plate) {
      currentPlate = plate;
      currentDate = "";
      currentDateRow = 0;
      if (!custs.has(plate)) {
        custs.set(plate, {
          province: "",
          name: "",
          phones: [],
          note: "",
          brand: "",
          model: "",
          year: "",
        });
        order.push(plate);
      }
    }
    if (currentPlate) {
      const c = custs.get(currentPlate)!;
      const first = (cur: string, v: string) => (cur === "" ? v : cur);
      c.province = first(c.province, cell(row, "province"));
      c.name = first(c.name, cell(row, "cust_name"));
      c.note = first(c.note, cell(row, "cust_note"));
      c.brand = first(c.brand, cell(row, "car_brand"));
      c.model = first(c.model, cell(row, "car_model_name"));
      c.year = first(c.year, cell(row, "car_year"));
      const phone = cell(row, "phone");
      if (phone && !c.phones.includes(phone)) c.phones.push(phone);
    }

    const date = cell(row, "date");
    if (date) {
      currentDate = date;
      currentDateRow = sheetRow;
    }
    const item = cell(row, "item");
    if (!item) continue;
    if (!currentPlate) {
      errors.push({ rowIndex: sheetRow, reason: "ไม่มีทะเบียน — no car above this row yet" });
      continue;
    }
    if (!currentDate) {
      errors.push({ rowIndex: sheetRow, reason: "ไม่มีวันที่ — this รายการ has no date above it" });
      continue;
    }
    const key = `${currentPlate} ${currentDate}`;
    if (!visits.has(key)) {
      visits.set(key, {
        plate: currentPlate,
        date: currentDate,
        items: [],
        sourceRow: currentDateRow,
      });
      visitOrder.push(key);
    }
    visits
      .get(key)!
      .items.push(
        formatRichLineItem(
          item,
          cell(row, "prod_brand"),
          cell(row, "prod_code"),
          cell(row, "hist_note"),
        ),
      );
  }

  const customers: string[][] = [
    ["ทะเบียน", "จังหวัด", "ชื่อลูกค้า", "เบอร์โทร", "รุ่นรถ", "หมายเหตุ"],
    ...order.map((p) => {
      const c = custs.get(p)!;
      return [
        p,
        c.province,
        c.name,
        c.phones.join(", "),
        [c.brand, c.model, c.year].filter(Boolean).join(" "),
        c.note,
      ];
    }),
  ];
  const history: string[][] = [["ทะเบียน", "วันที่", "รายการ"]];
  const historySourceRows: number[] = [];
  for (const key of visitOrder) {
    const v = visits.get(key)!;
    history.push([v.plate, v.date, v.items.join("\n")]);
    historySourceRows.push(v.sourceRow);
  }
  return { customers, history, historySourceRows, errors };
}

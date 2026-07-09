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

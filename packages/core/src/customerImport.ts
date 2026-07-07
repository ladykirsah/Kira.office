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

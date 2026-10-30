import {
  guessCustomerMapping,
  guessHistoryMapping,
  looksLikeCombinedSheet,
  looksLikeHistorySheet,
  looksLikeRichSheet,
  parseRichSheet,
  rowsToCsv,
  splitCombinedSheet,
} from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared";

/**
 * นำเข้าจาก Excel (drawn sheet, canvas v151): the same four kinds of file the old back office reads —
 * the owner's transcription form, a customers + history block sheet, a plain customer list, or a
 * service-history list. The columns are matched by their names; there is no mapping step.
 */

export type ImportKind = "rich" | "combined" | "history" | "customers";

export interface ImportPlan {
  kind: ImportKind;
  cars: number;
  visits: number;
  /** Why this file cannot be imported; null when it can. */
  problem: Phrase | null;
}

interface RowErrors {
  errors: readonly unknown[];
}

/** The server's import calls, passed in so this file stays pure. */
export interface ImportCalls {
  customers: (
    csv: string,
    mapping: Record<string, string>,
  ) => Promise<RowErrors & { created: number; updated: number }>;
  history: (
    csv: string,
    mapping: Record<string, string>,
  ) => Promise<RowErrors & { imported: number }>;
  visits: (
    visits: {
      licensePlate: string;
      happenedAt: string;
      note: string;
      lines: { description: string; productRef: string | null }[];
    }[],
  ) => Promise<RowErrors & { imported: number }>;
}

/** The transcription form's own column names (the old back office's template mappings). */
const CUSTOMER_TEMPLATE = {
  license_plate: "ทะเบียน",
  plate_province: "จังหวัด",
  customer_name: "ชื่อลูกค้า",
  phone: "เบอร์โทร",
  car_model: "รุ่นรถ",
  notes: "หมายเหตุ",
};
const HISTORY_TEMPLATE = { license_plate: "ทะเบียน", happened_at: "วันที่", description: "รายการ" };

const NO_DATA: Phrase = { th: "ไฟล์นี้ไม่มีข้อมูล", en: "This file has no data" };
const NO_PLATE: Phrase = {
  th: "ไม่พบคอลัมน์ทะเบียนในไฟล์นี้",
  en: "This file has no plate column",
};
const NO_HISTORY: Phrase = {
  th: "ไฟล์ประวัติต้องมีคอลัมน์ ทะเบียน วันที่ และรายการ",
  en: "A history file needs plate, date and work columns",
};

function kindOf(rows: string[][]): ImportKind {
  const header = rows[0] ?? [];
  if (looksLikeRichSheet(rows)) return "rich";
  if (looksLikeCombinedSheet(header)) return "combined";
  return looksLikeHistorySheet(header) ? "history" : "customers";
}

/** Distinct plates in one column of the data rows. */
function plateCount(rows: string[][], column: string | undefined): number {
  const at = column ? (rows[0] ?? []).indexOf(column) : -1;
  if (at < 0) return 0;
  return new Set(
    rows
      .slice(1)
      .map((r) => (r[at] ?? "").trim().replace(/\s+/g, " "))
      .filter(Boolean),
  ).size;
}

/** What the file holds, before anything is sent: the kind, how many cars and visits, or why not. */
export function readImport(rows: string[][]): ImportPlan {
  const kind = kindOf(rows);
  const plan = (cars: number, visits: number, problem: Phrase | null = null): ImportPlan => ({
    kind,
    cars,
    visits,
    problem,
  });
  if (rows.length < 2) return plan(0, 0, NO_DATA);
  if (kind === "rich") {
    const split = parseRichSheet(rows);
    return plan(Math.max(0, split.customers.length - 1), split.visits.length);
  }
  if (kind === "combined") {
    const split = splitCombinedSheet(rows);
    return plan(Math.max(0, split.customers.length - 1), Math.max(0, split.history.length - 1));
  }
  if (kind === "history") {
    const m = guessHistoryMapping(rows[0] ?? []);
    if (!m["license_plate"] || !m["happened_at"] || !m["description"]) {
      return plan(0, 0, NO_HISTORY);
    }
    return plan(plateCount(rows, m["license_plate"]), rows.length - 1);
  }
  const m = guessCustomerMapping(rows[0] ?? []);
  if (!m["license_plate"]) return plan(0, 0, NO_PLATE);
  return plan(plateCount(rows, m["license_plate"]), 0);
}

/** Send the file the way its kind needs; answers how many cars and visits went in, and rows that did not. */
export async function runImport(
  calls: ImportCalls,
  rows: string[][],
): Promise<{ cars: number; visits: number; failedRows: number }> {
  const kind = kindOf(rows);
  if (kind === "rich" || kind === "combined") {
    const rich = kind === "rich" ? parseRichSheet(rows) : null;
    const combined = kind === "combined" ? splitCombinedSheet(rows) : null;
    const customers = rich?.customers ?? combined!.customers;
    const cust =
      customers.length > 1 ? await calls.customers(rowsToCsv(customers), CUSTOMER_TEMPLATE) : null;
    let hist: (RowErrors & { imported: number }) | null = null;
    if (rich && rich.visits.length > 0) {
      hist = await calls.visits(
        rich.visits.map((v) => ({
          licensePlate: v.licensePlate,
          happenedAt: v.date,
          note: v.note,
          lines: v.lines,
        })),
      );
    } else if (combined && combined.history.length > 1) {
      hist = await calls.history(rowsToCsv(combined.history), HISTORY_TEMPLATE);
    }
    const sheetErrors = (rich ?? combined!).errors.length;
    return {
      cars: (cust?.created ?? 0) + (cust?.updated ?? 0),
      visits: hist?.imported ?? 0,
      failedRows: sheetErrors + (cust?.errors.length ?? 0) + (hist?.errors.length ?? 0),
    };
  }
  if (kind === "history") {
    const out = await calls.history(rowsToCsv(rows), guessHistoryMapping(rows[0] ?? []));
    return { cars: 0, visits: out.imported, failedRows: out.errors.length };
  }
  const out = await calls.customers(rowsToCsv(rows), guessCustomerMapping(rows[0] ?? []));
  return { cars: out.created + out.updated, visits: 0, failedRows: out.errors.length };
}

/**
 * Spreadsheet/CSV import normalization (Google Sheets products, Shopee Seller Centre orders).
 * Maps tabular rows to typed records via an explicit field->header mapping, trims values, and
 * reports rows missing required fields instead of failing the whole import. Pairs with parseCsv.
 */

export interface RowError {
  /** 1-based index among data rows (header excluded). */
  rowIndex: number;
  reason: string;
}

export interface MapRowsResult {
  records: Record<string, string>[];
  /** Source row index (1-based among data rows) per record — for errors found after mapping. */
  recordIndices: number[];
  errors: RowError[];
}

/**
 * `rows[0]` is the header. `fieldToHeader` maps each output field to its header column name;
 * a header column named here but absent in `rows[0]` throws (config error). Data rows missing a
 * `requiredFields` value (empty after trim) are reported in `errors` and skipped.
 */
export function mapRows(
  rows: string[][],
  fieldToHeader: Record<string, string>,
  requiredFields: string[] = [],
): MapRowsResult {
  if (rows.length === 0) return { records: [], recordIndices: [], errors: [] };

  for (const field of requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(fieldToHeader, field)) {
      throw new Error(`required field not mapped: ${field}`);
    }
  }

  const header = rows[0] ?? [];
  const columnOf: Record<string, number> = {};
  for (const [field, headerName] of Object.entries(fieldToHeader)) {
    const index = header.indexOf(headerName);
    if (index === -1) throw new Error(`missing column: ${headerName}`);
    columnOf[field] = index;
  }

  const records: Record<string, string>[] = [];
  const recordIndices: number[] = [];
  const errors: RowError[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const record: Record<string, string> = {};
    for (const field of Object.keys(fieldToHeader)) {
      record[field] = (row[columnOf[field] ?? -1] ?? "").trim();
    }
    const missing = requiredFields.find((field) => (record[field] ?? "") === "");
    if (missing) {
      errors.push({ rowIndex: i, reason: `missing required field: ${missing}` });
    } else {
      records.push(record);
      recordIndices.push(i);
    }
  }
  return { records, recordIndices, errors };
}

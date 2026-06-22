/**
 * Shopee order-import core (CSV bridge before the live API). Pure functions only.
 *
 * `parseCsv` tokenizes Seller Centre CSV exports; `dedupeOrders` enforces the same uniqueness as the
 * D1 constraint `(channel, external_order_id)`, so re-importing the same file never creates duplicate
 * orders. Both are wrapped by the import endpoint / queue consumer.
 */

/** Minimal RFC-4180-style CSV parser: quoted fields, doubled-quote escapes, CRLF or LF rows. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface ImportableOrder {
  channel: string;
  externalOrderId: string;
}

export interface OrderPartition<T> {
  fresh: T[];
  duplicates: T[];
}

/** Stable key matching the D1 unique index on (channel, external_order_id). */
export function orderKey(order: ImportableOrder): string {
  // Separate with NUL, which never appears in channel names or order ids, so keys cannot collide.
  return order.channel + String.fromCharCode(0) + order.externalOrderId;
}

/**
 * Split `incoming` into fresh vs duplicate by (channel, external_order_id), counting both
 * already-imported keys and repeats within this batch as duplicates. Order is preserved.
 */
export function dedupeOrders<T extends ImportableOrder>(
  existingKeys: Iterable<string>,
  incoming: T[],
): OrderPartition<T> {
  const seen = new Set(existingKeys);
  const fresh: T[] = [];
  const duplicates: T[] = [];
  for (const order of incoming) {
    const key = orderKey(order);
    if (seen.has(key)) {
      duplicates.push(order);
    } else {
      seen.add(key);
      fresh.push(order);
    }
  }
  return { fresh, duplicates };
}

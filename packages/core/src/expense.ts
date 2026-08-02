/**
 * Finance expenses — money out tagged to one channel (see migration 0081_expenses). Pure input
 * validation, shared by the API (to reject bad writes) and unit-tested here.
 */

export const EXPENSE_CHANNELS = ["onsite", "airplus"] as const;
export type ExpenseChannel = (typeof EXPENSE_CHANNELS)[number];

export function isExpenseChannel(x: unknown): x is ExpenseChannel {
  return typeof x === "string" && (EXPENSE_CHANNELS as readonly string[]).includes(x);
}

export interface ExpenseInput {
  channel: string;
  conversion: string;
  amountSatang: number;
  note?: string | null;
  occurredAt: number;
}

/**
 * Validate a create-expense payload. Returns the reason it's invalid, or null when it's good — the
 * API turns a non-null reason into a 400 rather than writing a malformed row.
 */
export function validateExpenseInput(
  input: Partial<ExpenseInput> | null | undefined,
): string | null {
  if (!input) return "expense body is required";
  if (!isExpenseChannel(input.channel)) return "channel must be 'onsite' or 'airplus'";
  if (typeof input.conversion !== "string" || input.conversion.trim() === "") {
    return "conversion (label) is required";
  }
  if (
    typeof input.amountSatang !== "number" ||
    !Number.isInteger(input.amountSatang) ||
    input.amountSatang <= 0
  ) {
    return "amountSatang must be a positive integer";
  }
  if (typeof input.occurredAt !== "number" || !Number.isFinite(input.occurredAt)) {
    return "occurredAt must be a timestamp";
  }
  return null;
}

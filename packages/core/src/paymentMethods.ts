/**
 * Shop payment methods — multiple PromptPay accounts (the owner's, mom's, dad's…) with exactly one
 * default. Stored as a JSON string in shop-info KV (`shop:paymentMethods`) and edited on the Shop
 * page; the Payment page offers them as the method dropdown. Parsing is tolerant (bad JSON → []),
 * serialization normalizes so exactly one method carries the default flag.
 */

export interface PaymentMethod {
  id: string;
  position: string; // the person's role in the shop ("เจ้าของ", "พนักงาน") — shown on the Pay-to dropdown
  label: string; // who gets paid — "ร้าน", "แม่", "พ่อ" …
  promptpayId: string; // phone / national ID / e-wallet (validated by promptpay.ts at QR time)
  isDefault?: boolean;
}

/** Parse the stored JSON; tolerant — bad JSON / wrong shapes / incomplete entries are dropped. */
export function parsePaymentMethods(json: string | null | undefined): PaymentMethod[] {
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: PaymentMethod[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== "string" || !e.id) continue;
    if (typeof e.label !== "string" || !e.label.trim()) continue;
    if (typeof e.promptpayId !== "string" || !e.promptpayId.trim()) continue;
    out.push({
      id: e.id,
      position: typeof e.position === "string" ? e.position : "", // optional; older data has none
      label: e.label,
      promptpayId: e.promptpayId,
      ...(e.isDefault === true ? { isDefault: true } : {}),
    });
  }
  return out;
}

/** The default method: the flagged one, else the first, else null when empty. */
export function defaultPaymentMethod(methods: PaymentMethod[]): PaymentMethod | null {
  return methods.find((m) => m.isDefault) ?? methods[0] ?? null;
}

/** Serialize for storage, normalized: exactly one default (first flagged wins, else the first). */
export function serializePaymentMethods(methods: PaymentMethod[]): string {
  const defaultId = defaultPaymentMethod(methods)?.id;
  return JSON.stringify(
    methods.map((m) => ({
      id: m.id,
      position: m.position ?? "",
      label: m.label,
      promptpayId: m.promptpayId,
      ...(m.id === defaultId ? { isDefault: true } : {}),
    })),
  );
}

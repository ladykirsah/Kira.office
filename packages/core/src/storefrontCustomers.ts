/**
 * AirPlus storefront customer accounts (`storefront_customers`) — the AirPlus half of the customer
 * directory. Deliberately separate from the plate-keyed `customers` table used by Den Air Service:
 * different key (phone vs licence plate), different consent basis, different business. See the
 * header of migration 0037 for why they were never merged.
 */

/** Prefix on every AirPlus customer code, so a pasted ID is obviously ours and obviously a customer. */
export const CUSTOMER_CODE_PREFIX = "AP-";

/**
 * The customer's public User ID — shown in Kira.office and on their own AirPlus account page, so
 * the two sides can refer to the same person out loud (over LINE, on the phone, on an invoice).
 *
 * Random, not sequential: a running number would tell customer #3 that they are the third customer
 * ever, which is not something a new shop wants to publish. 8 hex chars = 4.3 billion codes, so a
 * collision against an existing row is ~1 in 430,000 even at ten thousand customers — and the
 * UNIQUE index makes a collision fail loudly rather than hand two people the same ID.
 */
export function generateCustomerCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${CUSTOMER_CODE_PREFIX}${hex.toUpperCase()}`;
}

const CUSTOMER_CODE_RE = /^AP-[0-9A-F]{8}$/;

/** True for a well-formed customer code. Strict: a typo must miss rather than match someone else. */
export function isCustomerCode(value: string): boolean {
  return CUSTOMER_CODE_RE.test(value);
}

/** Identity-bearing fields blanked when a customer exercises their PDPA right to erasure. */
export type AnonymizedCustomerPatch = {
  id: string;
  name: string;
  phone: string;
  email: null;
  lineUserId: null;
  facebookId: null;
  passwordHash: null;
  marketingConsentAt: null;
  status: "anonymized";
  anonymizedAt: number;
};

/**
 * Shown in place of the name once erased. Deliberately NOT `''` — the empty string already means
 * "name not captured yet" for accounts created at OTP-verify (see migration 0041), and the two
 * must stay tellable apart.
 */
export const ANONYMIZED_NAME = "ลบข้อมูลแล้ว";

/**
 * Builds the patch that erases a customer's identity while leaving the row (and therefore their
 * orders) in place. `phone` is NOT NULL UNIQUE, so it cannot be blanked — it becomes a per-id
 * placeholder that can never collide with a real Thai number.
 */
export function anonymizeStorefrontCustomer(input: {
  id: string;
  at: number;
}): AnonymizedCustomerPatch {
  return {
    id: input.id,
    name: ANONYMIZED_NAME,
    phone: `deleted:${input.id}`,
    email: null,
    lineUserId: null,
    facebookId: null,
    passwordHash: null,
    marketingConsentAt: null,
    status: "anonymized",
    anonymizedAt: input.at,
  };
}

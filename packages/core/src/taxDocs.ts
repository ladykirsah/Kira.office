/**
 * VAT billing (plan 10.2, owner 17 Nov 2026) — the rules for tax invoices and credit notes. Pure.
 *
 * The owner's model: B2C gets a cash bill; B2B gets a cash bill or a full tax invoice (ใบกำกับภาษี
 * เต็มรูป), picked per sale, with the company's details kept in a book for next time. Global
 * practice (PEAK, FlowAccount): a receipt with a "tax invoice" switch, a contact book holding the
 * buyer's tax ID and branch, running numbers made by the system, never deleted, cancelled with a
 * reason, a credit note for a refund. Not tax advice — the shop confirms with its accountant.
 */

/** The digits of a tax ID, whatever dashes or spaces it was typed with. */
export function normalizeTaxId(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/**
 * A Thai 13-digit tax ID, checked by its last digit (the same check the national ID uses): each of
 * the first 12 digits times 13 down to 2, summed; the check digit is (11 − sum mod 11) mod 10.
 */
export function taxIdProblem(raw: string): string | null {
  const id = normalizeTaxId(raw);
  if (!/^\d{13}$/.test(id)) return "tax ID must be 13 digits";
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]) ? null : "tax ID check digit is wrong";
}

const HEAD_OFFICE = "00000";

/** The branch code as stored: blank means head office (สำนักงานใหญ่, 00000). */
export function branchCode(raw: string | null | undefined): string {
  const code = (raw ?? "").trim();
  return code === "" ? HEAD_OFFICE : code;
}

const branchProblem = (raw: string | null | undefined): string | null =>
  /^\d{5}$/.test(branchCode(raw)) ? null : "branch must be 5 digits";

/** สำนักงานใหญ่, or สาขาที่ 00002 — how a tax invoice names a branch. */
export function branchLabel(raw: string | null | undefined): { th: string; en: string } {
  const code = branchCode(raw);
  return code === HEAD_OFFICE
    ? { th: "สำนักงานใหญ่", en: "Head office" }
    : { th: `สาขาที่ ${code}`, en: `Branch ${code}` };
}

/**
 * The shop's VAT billing switch (ข้อมูลร้าน). Never set reads as on: Den Air is VAT-registered and
 * its bills have always carried VAT on parts, so nothing changes for it the day this ships.
 */
export function vatBillingOn(value: string | null | undefined): boolean {
  return value !== "off";
}

export interface ShopTaxFields {
  taxId: string;
  taxName: string;
  taxAddress: string;
  taxBranch: string;
}

/** What the shop still has to fill in before it can issue a tax invoice; empty when ready. */
export function shopTaxMissing(shop: ShopTaxFields): (keyof ShopTaxFields)[] {
  const missing: (keyof ShopTaxFields)[] = [];
  if (taxIdProblem(shop.taxId)) missing.push("taxId");
  if (!shop.taxName.trim()) missing.push("taxName");
  if (!shop.taxAddress.trim()) missing.push("taxAddress");
  if (branchProblem(shop.taxBranch)) missing.push("taxBranch");
  return missing;
}

/**
 * Checks for a ข้อมูลร้าน save that touches the tax fields (the save is partial: a field left out is
 * not checked). Blank tax ID or branch is allowed — the shop fills them in when it is ready.
 */
export function shopTaxEditProblem(body: Record<string, unknown>): string | null {
  const str = (k: string) => String(body[k] ?? "").trim();
  if ("vatBilling" in body && !["on", "off"].includes(str("vatBilling"))) {
    return "vatBilling must be on or off";
  }
  if ("taxId" in body && str("taxId") !== "") {
    const bad = taxIdProblem(str("taxId"));
    if (bad) return bad;
  }
  if ("taxBranch" in body) return branchProblem(str("taxBranch"));
  return null;
}

export interface TaxBuyerInput {
  name?: unknown;
  taxId?: unknown;
  branch?: unknown;
  address?: unknown;
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** A company for the book (and for a tax invoice): name, tax ID, branch, address. */
export function taxBuyerProblem(buyer: TaxBuyerInput): string | null {
  if (!text(buyer.name)) return "company name is required";
  const idProblem = taxIdProblem(text(buyer.taxId));
  if (idProblem) return idProblem;
  if (buyer.branch != null && typeof buyer.branch !== "string") return "branch must be 5 digits";
  const bad = branchProblem(buyer.branch as string | undefined);
  if (bad) return bad;
  if (!text(buyer.address)) return "address is required";
  return null;
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const pad = (n: number, width: number) => String(n).padStart(width, "0");

/**
 * The next running number for a tax invoice (TI) or credit note (CN): TIyyyymm-nnnn by the Thai
 * month, one after this month's highest of the same kind. Made by the server only.
 */
export function nextTaxDocNumber(
  prefix: "TI" | "CN",
  known: readonly string[],
  now: number,
): string {
  const d = new Date(now + BANGKOK_OFFSET_MS);
  const month = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1, 2)}`;
  const pattern = new RegExp(`^${prefix}${month}-(\\d+)$`);
  let highest = 0;
  for (const n of known) {
    const hit = pattern.exec(n);
    if (hit) highest = Math.max(highest, Number(hit[1]));
  }
  return `${prefix}${month}-${pad(highest + 1, 4)}`;
}

/** The Thai calendar day of a moment, for "issued the same day as the bill". */
export function bangkokDay(ms: number): string {
  return new Date(ms + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

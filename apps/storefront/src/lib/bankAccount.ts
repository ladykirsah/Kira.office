import type { KVNamespace } from "@cloudflare/workers-types";
import { shopKey } from "@l-shopee/core";

/**
 * The bank account a โอนเข้าบัญชีร้าน order is told to pay into (plan 8.7, 17 Nov 2026). The owner
 * sets it on ข้อมูลร้าน → AirPlus → บัญชีธนาคาร; each transfer order keeps a copy on its payments row
 * (bank_account, migration 0104), so changing banks later never changes an old order.
 */
export interface BankAccount {
  bank: string;
  accountName: string;
  accountNumber: string;
}

/** AirPlus's own account (Den Air's is never used here), or null until it has a number. */
export async function airplusBankAccount(kv: KVNamespace): Promise<BankAccount | null> {
  const [bank, accountName, accountNumber] = await Promise.all(
    ["bankName", "bankAccountName", "bankAccountNumber"].map(
      async (field) => (await kv.get(shopKey("airplus", field)))?.trim() ?? "",
    ),
  );
  return accountNumber ? { bank: bank!, accountName: accountName!, accountNumber } : null;
}

/** The account kept with an order, or null for none (PromptPay, COD, older orders) or unreadable. */
export function readBankAccount(kept: string | null): BankAccount | null {
  if (!kept) return null;
  try {
    const v = JSON.parse(kept) as Partial<BankAccount> | null;
    if (typeof v !== "object" || v === null || typeof v.accountNumber !== "string") return null;
    if (!v.accountNumber) return null;
    return {
      bank: typeof v.bank === "string" ? v.bank : "",
      accountName: typeof v.accountName === "string" ? v.accountName : "",
      accountNumber: v.accountNumber,
    };
  } catch {
    return null;
  }
}

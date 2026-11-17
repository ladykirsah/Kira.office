import { describe, expect, it } from "vitest";
import type { KVNamespace } from "@cloudflare/workers-types";
import { airplusBankAccount, readBankAccount } from "./bankAccount";

/** Plan 8.7 (17 Nov 2026): the bank account a โอนเข้าบัญชีร้าน order is told to pay into. */

function kv(values: Record<string, string>): KVNamespace {
  return { get: async (key: string) => values[key] ?? null } as unknown as KVNamespace;
}

describe("airplusBankAccount > AirPlus's account from ข้อมูลร้าน", () => {
  it("given bank, name and number on AirPlus > then all three, tidied", async () => {
    const account = await airplusBankAccount(
      kv({
        "shop:airplus:bankName": " กสิกรไทย ",
        "shop:airplus:bankAccountName": "บจก. แอร์พลัส",
        "shop:airplus:bankAccountNumber": " 123-4-56789-0 ",
        "shop:denair:bankAccountNumber": "999",
      }),
    );
    expect(account).toEqual({
      bank: "กสิกรไทย",
      accountName: "บจก. แอร์พลัส",
      accountNumber: "123-4-56789-0",
    });
  });

  it("given no account number on AirPlus (only Den Air has one) > then none", async () => {
    expect(
      await airplusBankAccount(
        kv({ "shop:airplus:bankName": "กสิกรไทย", "shop:denair:bankAccountNumber": "999" }),
      ),
    ).toBeNull();
  });
});

describe("readBankAccount > the account kept with an order", () => {
  it("given the kept account > then it reads back", () => {
    const kept = { bank: "กสิกรไทย", accountName: "แอร์พลัส", accountNumber: "1234567890" };
    expect(readBankAccount(JSON.stringify(kept))).toEqual(kept);
  });

  it("given none, broken text, or no number > then none", () => {
    expect([
      readBankAccount(null),
      readBankAccount("not json"),
      readBankAccount(JSON.stringify({ bank: "กสิกรไทย" })),
      readBankAccount("[]"),
    ]).toEqual([null, null, null, null]);
  });
});

import type { Phrase } from "@l-shopee/shared/lang";
import { failure, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/**
 * ค่าคอม Shopee (canvas v369, owner 5 Nov 2026: "i want A, but on the main page is total %, and the
 * pop up shown all amount we have been charged"): ข้อมูลร้าน shows the total of Shopee's fees; its
 * sheet lists each fee. One set for the whole business, in hundredths of a percent (3.21% = 321) —
 * the API's /shopee-fees. The product page takes the total off the Shopee price for its profit.
 */
export interface ShopeeFees {
  commissionBp: number;
  transactionBp: number;
  serviceBp: number;
}

export type FeeKey = keyof ShopeeFees;

export const NO_FEES: ShopeeFees = { commissionBp: 0, transactionBp: 0, serviceBp: 0 };

/** The sheet's rows, in the drawn order. */
export const FEE_ROWS: { key: FeeKey; label: Phrase }[] = [
  { key: "commissionBp", label: { th: "ค่าคอมมิชชั่น", en: "Commission" } },
  { key: "transactionBp", label: { th: "ค่าธรรมเนียมธุรกรรม", en: "Transaction fee" } },
  { key: "serviceBp", label: { th: "ค่าบริการโปรแกรม", en: "Programme fee" } },
];

export const totalBp = (f: ShopeeFees): number => f.commissionBp + f.transactionBp + f.serviceBp;

/** A fee as words: "17%", "3.21%", "3.5%", "0%". */
export const percentText = (bp: number): string => `${percentInput(bp) || "0"}%`;

/** A fee in its box: "12", "3.21"; 0 is an empty box (its hint says 0). */
export function percentInput(bp: number): string {
  if (!bp) return "";
  return (bp / 100).toFixed(2).replace(/\.?0+$/, "");
}

/** 100% in hundredths of a percent. */
const WHOLE = 10_000;

/** A typed % → hundredths of a percent; empty is 0; anything else that is not 0–100 with up to two decimals is null. */
export function parsePercent(typed: string): number | null {
  const bp = readBox(typed);
  return bp !== null && bp <= WHOLE ? bp : null;
}

/** A typed % → hundredths of a percent, with no 100% cap: a box over 100 still adds into รวม. */
function readBox(typed: string): number | null {
  const raw = typed.trim();
  if (!raw) return 0;
  return /^\d+(\.\d{1,2})?$/.test(raw) ? Math.round(Number(raw) * 100) : null;
}

export async function fetchShopeeFees(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<ShopeeFees> {
  const res = await fetchFn(`${base}/shopee-fees`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Shopee fees failed to load");
  return (await res.json()) as ShopeeFees;
}

/** The owner saves all three at once; the server answers with what it kept. */
export async function saveShopeeFees(
  fetchFn: FetchFn,
  base: string,
  token: string,
  fees: ShopeeFees,
): Promise<ShopeeFees> {
  const res = await fetchFn(`${base}/shopee-fees`, {
    method: "PUT",
    headers: { ...session(token), "content-type": "application/json" },
    body: JSON.stringify(fees),
  });
  if (!res.ok) throw await failure(res, "Shopee fees failed to save");
  return (await res.json()) as ShopeeFees;
}

/** The sheet's three boxes as typed. */
export type FeeDraft = Record<FeeKey, string>;

export type FeeProblems = Partial<Record<FeeKey | "total", Phrase>>;

export const draftOf = (f: ShopeeFees): FeeDraft => ({
  commissionBp: percentInput(f.commissionBp),
  transactionBp: percentInput(f.transactionBp),
  serviceBp: percentInput(f.serviceBp),
});

const NOT_A_PERCENT: Phrase = { th: "ใส่เป็นตัวเลข 0–100", en: "A number from 0 to 100" };
const OVER_WHOLE: Phrase = { th: "รวมเกิน 100%", en: "The total is over 100%" };

/**
 * The boxes as fees to save, or what is wrong: under the box that isn't a %, or under รวม.
 * `totalBp` is what รวม shows — the real sum even when it is over 100%, null while a box isn't a number.
 */
export function readDraft(d: FeeDraft): {
  fees: ShopeeFees | null;
  problems: FeeProblems;
  totalBp: number | null;
} {
  const problems: FeeProblems = {};
  const fees = { ...NO_FEES };
  let sum: number | null = 0;
  for (const { key } of FEE_ROWS) {
    const bp = parsePercent(d[key]);
    if (bp === null) problems[key] = NOT_A_PERCENT;
    else fees[key] = bp;
    const typed = readBox(d[key]);
    sum = sum === null || typed === null ? null : sum + typed;
  }
  if (Object.keys(problems).length === 0 && totalBp(fees) > WHOLE) problems.total = OVER_WHOLE;
  const ok = Object.keys(problems).length === 0;
  return { fees: ok ? fees : null, problems, totalBp: sum };
}

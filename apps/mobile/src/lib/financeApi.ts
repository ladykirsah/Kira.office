import type { Bill, Expense, MoneyOrder, Range, Shop } from "./financePage";
import { failure, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/**
 * การเงิน's calls. The books are the owner's alone; the API refuses anyone else (super_admin_only
 * on /finance, and on /sales/:id/refund).
 */

/** Every Den Air Service bill in the period — not the latest 100, so a long period adds up. */
export async function fetchBills(
  fetchFn: FetchFn,
  base: string,
  token: string,
  r: Range,
): Promise<Bill[]> {
  const res = await fetchFn(`${base}/sales?from=${r.from}&to=${r.to}`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Bills failed to load");
  return ((await res.json()) as { sales: Bill[] }).sales;
}

/** Every order with the money the server derives; the page keeps the AirPlus ones that moved money. */
export async function fetchMoneyOrders(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<MoneyOrder[]> {
  const res = await fetchFn(`${base}/orders`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Orders failed to load");
  return ((await res.json()) as { orders: MoneyOrder[] }).orders;
}

export async function fetchExpenses(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<Expense[]> {
  const res = await fetchFn(`${base}/finance/expenses`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Expenses failed to load");
  return ((await res.json()) as { expenses: Expense[] }).expenses;
}

const expenseUrl = (base: string, id: string) =>
  `${base}/finance/expenses/${encodeURIComponent(id)}`;

/** New (no id) → POST; an id → PUT to that expense. */
export async function saveExpense(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string | null,
  body: {
    channel: Shop;
    conversion: string;
    amountSatang: number;
    occurredAt: number;
    note?: string;
  },
): Promise<Expense | null> {
  const res = await fetchFn(id ? expenseUrl(base, id) : `${base}/finance/expenses`, {
    method: id ? "PUT" : "POST",
    headers: { ...session(token), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await failure(res, "Expense not saved");
  return ((await res.json()) as { expense?: Expense }).expense ?? null;
}

export async function deleteExpense(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<void> {
  const res = await fetchFn(expenseUrl(base, id), { method: "DELETE", headers: session(token) });
  if (!res.ok) throw await failure(res, "Expense not deleted");
}

/** Stock goes back and the bill reads คืนเงินแล้ว. A refund the server didn't apply is an error. */
export async function refundBill(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<void> {
  const res = await fetchFn(`${base}/sales/${encodeURIComponent(id)}/refund`, {
    method: "POST",
    headers: session(token),
  });
  if (!res.ok) throw await failure(res, "Refund failed");
  const out = (await res.json()) as { applied?: boolean; reason?: string };
  if (!out.applied) throw new Error(out.reason ?? "Refund not applied");
}

/** The expense's slip picture, for useStaffImage to fetch behind the session. */
export const expenseSlipPath = (id: string) => `/finance/expenses/${encodeURIComponent(id)}/slip`;

/** Keep a slip on an expense (📎); a new one replaces the old. The picture is the body. */
export async function putExpenseSlip(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  photo: Blob,
): Promise<void> {
  const res = await fetchFn(`${base}${expenseSlipPath(id)}`, {
    method: "PUT",
    headers: { ...session(token), "content-type": photo.type || "image/jpeg" },
    body: photo,
  });
  if (!res.ok) throw await failure(res, "Slip not saved");
}

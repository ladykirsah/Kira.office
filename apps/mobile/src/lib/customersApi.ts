import type { MonthCount } from "./customerPage";
import { getJson } from "./posApi";
import { failure, sendJson, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/** A car on the หน้าร้าน list (GET /customers). */
export interface CarRow {
  licensePlate: string;
  plateProvince: string | null;
  vehicle: string | null;
  customerName: string | null;
  phone: string | null;
  carModel: string | null;
  billCount: number;
  lastVisitAt: number | null;
}

/** The summary card's counts (GET /customers/summary, GET /storefront-customers/summary). */
export interface CustomerSummary {
  total: number;
  activeThisMonth: number;
  newThisMonth: number;
  months: MonthCount[];
}

export interface CarSaleLine {
  description: string;
  lineType: string;
  quantity: number;
  unitPriceSatang: number;
  discountSatang: number;
  productRef: string | null;
  brandName: string | null;
}

/** A bill or open quotation of one car. */
export interface CarSale {
  id: string;
  saleNumber: string | null;
  stage: string;
  createdAt: number;
  subtotalSatang: number;
  discountTotalSatang: number;
  taxTotalSatang: number;
  grandTotalSatang: number;
  notes: string | null;
  vehicle: string | null;
  mileageKm: number | null;
  buyerName: string | null;
  paymentMethod: string | null;
  lines: CarSaleLine[];
}

/** One car's page (GET /customers/:plate). */
export interface CarDetail {
  customer: {
    licensePlate: string;
    plateProvince: string | null;
    customerName: string | null;
    phone: string | null;
    carModel: string | null;
    notes: string | null;
  } | null;
  vehicle: string | null;
  history: CarSale[];
  quotations: CarSale[];
  legacy: {
    id: string;
    happenedAt: number;
    note: string | null;
    lines: { description: string; productRef: string | null }[];
  }[];
  lastMileage: { km: number; at: number } | null;
}

/** An AirPlus account on the list (GET /storefront-customers). */
export interface AccountRow {
  id: string;
  name: string | null;
  customerCode: string | null;
  anonymizedAt: number | null;
  lastOrderAt: number | null;
  createdAt: number;
}

export interface AccountOrder {
  id: string;
  externalOrderId: string | null;
  orderStatus: string | null;
  paymentStatus: string | null;
  orderCreatedAt: number | null;
  items: string[];
}

/** One AirPlus account (GET /storefront-customers/:id). */
export interface AccountDetail {
  customer: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    customerCode: string | null;
    tier: string | null;
    createdAt: number;
    phoneVerifiedAt: number | null;
    pdpaConsentAt: number | null;
    marketingConsentAt: number | null;
    anonymizedAt: number | null;
    lineLinked: number;
  } | null;
  orders: AccountOrder[];
}

async function post(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  what: string,
): Promise<Response> {
  const res = await fetchFn(url, init);
  if (!res.ok) throw await failure(res, what);
  return res;
}

const query = (q: string) => encodeURIComponent(q.trim());

export const fetchCarList = async (fetchFn: FetchFn, base: string, token: string, q: string) =>
  (
    await getJson<{ customers: CarRow[] }>(
      fetchFn,
      `${base}/customers?q=${query(q)}`,
      token,
      "Customers failed to load",
    )
  ).customers;

/** หน้าร้าน counts cars; AirPlus counts accounts. */
export const fetchSummary = (
  fetchFn: FetchFn,
  base: string,
  token: string,
  side: "shop" | "airplus",
) =>
  getJson<CustomerSummary>(
    fetchFn,
    `${base}/${side === "shop" ? "customers" : "storefront-customers"}/summary`,
    token,
    "Summary failed to load",
  );

export const fetchCarDetail = (fetchFn: FetchFn, base: string, token: string, plate: string) =>
  getJson<CarDetail>(
    fetchFn,
    `${base}/customers/${encodeURIComponent(plate.trim())}`,
    token,
    "Customer failed to load",
  );

export const fetchAccounts = async (fetchFn: FetchFn, base: string, token: string, q: string) =>
  (
    await getJson<{ customers: AccountRow[] }>(
      fetchFn,
      `${base}/storefront-customers?q=${query(q)}`,
      token,
      "Accounts failed to load",
    )
  ).customers;

export const fetchAccount = (fetchFn: FetchFn, base: string, token: string, id: string) =>
  getJson<AccountDetail>(
    fetchFn,
    `${base}/storefront-customers/${encodeURIComponent(id)}`,
    token,
    "Account failed to load",
  );

/** รับข่าวสาร: record the customer's yes, or withdraw it. */
export async function setMarketing(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  optedIn: boolean,
): Promise<void> {
  await post(
    fetchFn,
    `${base}/storefront-customers/${encodeURIComponent(id)}/marketing`,
    { ...sendJson(token, { optedIn }), method: "PUT" },
    "Consent was not saved",
  );
}

/** ลบข้อมูลตาม PDPA: the identity is blanked; the orders stay (tax records). */
export async function eraseAccount(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<void> {
  await post(
    fetchFn,
    `${base}/storefront-customers/${encodeURIComponent(id)}/anonymize`,
    { method: "POST", headers: session(token) },
    "Account was not erased",
  );
}

/** อัปเดตเครดิตทั้งหมด: every account's credit and level worked out again. */
export async function recalcAllCredit(fetchFn: FetchFn, base: string, token: string) {
  await post(
    fetchFn,
    `${base}/storefront-customers/recalculate-credit-all`,
    { method: "POST", headers: session(token) },
    "Credit was not updated",
  );
}

/** The Excel import's three server calls (see customerImport). */
export function importCalls(fetchFn: FetchFn, base: string, token: string) {
  const send = async <T>(path: string, body: unknown): Promise<T> =>
    (await (
      await post(fetchFn, `${base}${path}`, sendJson(token, body), "Import failed")
    ).json()) as T;
  return {
    customers: (csv: string, mapping: Record<string, string>) =>
      send<{ created: number; updated: number; errors: unknown[] }>("/import/customers", {
        csv,
        mapping,
      }),
    history: (csv: string, mapping: Record<string, string>) =>
      send<{ imported: number; errors: unknown[] }>("/import/customer-history", { csv, mapping }),
    visits: (visits: unknown[]) =>
      send<{ imported: number; errors: unknown[] }>("/import/customer-history", { visits }),
  };
}

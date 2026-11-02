import { failure, sendJson, session } from "./scanApi";
import type { FetchFn } from "./signIn";
import type { PayRow, PaymentMonth, SlipRef, StaffPerson } from "./staffPage";

/**
 * พนักงาน's calls — the staff endpoints the web back office's staff pages use, plus the add form,
 * photos and who-paid that the Expo pages brought (migration 0097). Every one is owner-only on the
 * server.
 */

/** A box the server refused, with the box it belongs under (the add and edit forms). */
export class StaffRefusal extends Error {
  constructor(
    readonly code: string,
    readonly field: string | null,
    message: string,
  ) {
    super(message);
  }
}

/** The server's `{ error, field, message }` as a StaffRefusal; its plain `{ error }` as an Error. */
async function refused(res: Response, what: string): Promise<Error> {
  const body = (await res
    .clone()
    .json()
    .catch(() => ({}))) as { error?: unknown; field?: unknown; message?: unknown };
  if (typeof body.error === "string" && typeof body.message === "string") {
    const field = typeof body.field === "string" ? body.field : null;
    return new StaffRefusal(body.error, field, body.message);
  }
  return failure(res, what);
}

const yes = (v: unknown) => v === true || v === 1;
const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

async function readJson<T>(fetchFn: FetchFn, url: string, token: string, what: string) {
  const res = await fetchFn(url, { headers: session(token) });
  if (!res.ok) throw await failure(res, what);
  return (await res.json()) as T;
}

async function send(
  fetchFn: FetchFn,
  url: string,
  token: string,
  method: string,
  body: unknown,
  what: string,
): Promise<Response> {
  const res = await fetchFn(url, { ...sendJson(token, body), method });
  if (!res.ok) throw await refused(res, what);
  return res;
}

async function remove(fetchFn: FetchFn, url: string, token: string, what: string) {
  const res = await fetchFn(url, { method: "DELETE", headers: session(token) });
  if (!res.ok) throw await refused(res, what);
}

type Raw = Record<string, unknown>;

function person(r: Raw): StaffPerson {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    nameTh: text(r.nameTh),
    nameEn: text(r.nameEn),
    role: String(r.role ?? ""),
    status: String(r.status ?? "active"),
    lastLoginAt: num(r.lastLoginAt),
    lockedUntil: num(r.lockedUntil),
    phone: text(r.phone),
    hasPhoto: yes(r.hasPhoto),
  };
}

/** Everyone, as the คน tab lists them. */
export async function fetchTeam(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<(StaffPerson & { dayRateSatang: number | null })[]> {
  const body = await readJson<{ staff?: Raw[] }>(
    fetchFn,
    `${base}/staff`,
    token,
    "Staff failed to load",
  );
  return (body.staff ?? []).map((r) => ({ ...person(r), dayRateSatang: num(r.dayRateSatang) }));
}

/** One person's page: every field, and their password and PIN in readable form (owner only). */
export interface StaffProfile extends StaffPerson {
  email: string | null;
  fullNameTh: string | null;
  fullNameEn: string | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  startedOn: number | null;
  dayRateSatang: number | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  password: string | null;
  pin: string | null;
  hasPin: boolean;
  hasPassword: boolean;
}

export async function fetchProfile(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<StaffProfile> {
  const body = await readJson<{ profile: Raw }>(
    fetchFn,
    `${base}/staff/${encodeURIComponent(id)}/profile`,
    token,
    "Person failed to load",
  );
  const r = body.profile;
  return {
    ...person(r),
    email: text(r.email),
    fullNameTh: text(r.fullNameTh),
    fullNameEn: text(r.fullNameEn),
    emergencyName: text(r.emergencyName),
    emergencyRelation: text(r.emergencyRelation),
    emergencyPhone: text(r.emergencyPhone),
    startedOn: num(r.startedOn),
    dayRateSatang: num(r.dayRateSatang),
    bankName: text(r.bankName),
    bankAccountNo: text(r.bankAccountNo),
    bankAccountName: text(r.bankAccountName),
    password: text(r.password),
    pin: text(r.pin),
    hasPin: yes(r.hasPin),
    hasPassword: yes(r.hasPassword),
  };
}

/** The add form as the server takes it; blank boxes are left out. */
export interface NewStaff {
  nameTh?: string;
  nameEn?: string;
  fullNameTh?: string;
  fullNameEn?: string;
  phone?: string;
  email?: string;
  emergencyName?: string;
  emergencyRelation?: string;
  emergencyPhone?: string;
  role?: string;
  dayRateSatang?: number;
  startedOn?: number;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  password?: string;
  pin?: string;
}

export async function createStaff(
  fetchFn: FetchFn,
  base: string,
  token: string,
  form: NewStaff,
): Promise<string> {
  const res = await send(fetchFn, `${base}/staff`, token, "POST", form, "Person was not added");
  return String(((await res.json()) as { id?: unknown }).id ?? "");
}

const one = (base: string, id: string, rest = "") =>
  `${base}/staff/${encodeURIComponent(id)}${rest}`;

/** Only the fields sent change. A blank clears it (email included: then PIN only). */
export async function updateProfile(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  patch: Record<string, string | number | null>,
): Promise<void> {
  await send(fetchFn, one(base, id, "/profile"), token, "PATCH", patch, "Not saved");
}

/** ตำแหน่ง and เปิดใช้ (switching someone off signs them out everywhere). */
export async function updateStaff(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  patch: { role?: string; status?: string },
): Promise<void> {
  await send(fetchFn, one(base, id), token, "PATCH", patch, "Not saved");
}

export async function setPassword(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  password: string,
): Promise<void> {
  await send(fetchFn, one(base, id, "/password"), token, "POST", { password }, "Not saved");
}

export async function setPin(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  pin: string,
): Promise<void> {
  await send(fetchFn, one(base, id, "/pin"), token, "POST", { pin }, "Not saved");
}

export async function clearPin(fetchFn: FetchFn, base: string, token: string, id: string) {
  await remove(fetchFn, one(base, id, "/pin"), token, "Not cleared");
}

export async function deleteStaff(fetchFn: FetchFn, base: string, token: string, id: string) {
  await remove(fetchFn, one(base, id), token, "Not deleted");
}

/** The session plus a picture's own type, for the calls that send the picture as the body. */
const imageHeaders = (token: string, photo: Blob) => ({
  ...session(token),
  "content-type": photo.type || "image/jpeg",
});

/** The person's round photo; the server answers photo_type / photo_too_large as a refusal. */
export async function uploadPhoto(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  photo: Blob,
): Promise<void> {
  const res = await fetchFn(one(base, id, "/photo"), {
    method: "PUT",
    headers: imageHeaders(token, photo),
    body: photo,
  });
  if (!res.ok) throw await refused(res, "Photo was not saved");
}

/** A photo or slip behind the session, for useStaffImage to fetch. */
export const photoPath = (id: string) => `/staff/${encodeURIComponent(id)}/photo`;

export function slipPath(slip: SlipRef, userId: string): string {
  return slip.kind === "salary"
    ? `/staff/${encodeURIComponent(userId)}/salary-slip?period=${slip.period}`
    : `/staff/advances/${encodeURIComponent(slip.id)}/slip`;
}

export async function fetchImage(
  fetchFn: FetchFn,
  base: string,
  token: string,
  path: string,
): Promise<Blob> {
  const res = await fetchFn(`${base}${path}`, { headers: session(token) });
  if (!res.ok) throw new Error(`Picture failed to load (HTTP ${res.status})`);
  return res.blob();
}

/** One month's salary run. A row from an older server without advances had none. */
export async function fetchSalary(
  fetchFn: FetchFn,
  base: string,
  token: string,
  month: string,
): Promise<PayRow[]> {
  const body = await readJson<{ rows?: Raw[] }>(
    fetchFn,
    `${base}/staff/salary?month=${month}`,
    token,
    "Salary failed to load",
  );
  return (body.rows ?? []).map((r) => {
    const amount = num(r.amountSatang) ?? 0;
    const advance = num(r.advanceSatang) ?? 0;
    return {
      userId: String(r.userId),
      name: String(r.name ?? ""),
      role: String(r.role ?? ""),
      dayRateSatang: num(r.dayRateSatang) ?? 0,
      workingHalves: num(r.workingHalves) ?? 0,
      offHalves: num(r.offHalves) ?? 0,
      amountSatang: amount,
      advanceSatang: advance,
      dueSatang: num(r.dueSatang) ?? amount - advance,
      paidAt: num(r.paidAt),
      bankName: text(r.bankName),
      bankAccountNo: text(r.bankAccountNo),
      bankAccountName: text(r.bankAccountName),
      hasSlip: yes(r.hasSlip),
    };
  });
}

export interface Payment {
  period: string;
  method: "transfer" | "cash";
  /** The slip (a transfer must have one) or a cash photo; null for cash without one. */
  photo: Blob | null;
  /** Who handed the cash over (an owner); the server takes the signed-in owner when left out. */
  paidBy?: string;
}

/** จ่ายเงินเดือน: the photo is the body, the month and method go in the address. */
export async function paySalary(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  p: Payment,
): Promise<void> {
  const query = new URLSearchParams({ period: p.period, method: p.method });
  if (p.paidBy) query.set("paidBy", p.paidBy);
  const init: RequestInit = { method: "POST", headers: session(token) };
  if (p.photo) {
    init.headers = imageHeaders(token, p.photo);
    init.body = p.photo;
  }
  const res = await fetchFn(one(base, id, `/salary-paid?${query}`), init);
  if (!res.ok) throw await refused(res, "Salary was not recorded");
}

/** One person's months, newest first, each with its advances. */
export async function fetchPayments(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<PaymentMonth[]> {
  const body = await readJson<{ payments?: Raw[] }>(
    fetchFn,
    one(base, id, "/payments"),
    token,
    "Salary failed to load",
  );
  return (body.payments ?? []).map((r) => ({
    period: String(r.period),
    dayRateSatang: num(r.dayRateSatang) ?? 0,
    offHalves: num(r.offHalves) ?? 0,
    workingHalves: num(r.workingHalves) ?? 0,
    earnedSatang: num(r.earnedSatang) ?? 0,
    advanceSatang: num(r.advanceSatang) ?? 0,
    dueSatang: num(r.dueSatang) ?? 0,
    owedSatang: num(r.owedSatang) ?? 0,
    paidAt: num(r.paidAt),
    method: text(r.method),
    hasSlip: yes(r.hasSlip),
    paidBy: text(r.paidBy),
    advances: ((r.advances as Raw[] | undefined) ?? []).map((a) => ({
      id: String(a.id),
      givenOn: String(a.givenOn ?? ""),
      amountSatang: num(a.amountSatang) ?? 0,
      method: String(a.method ?? ""),
      hasSlip: yes(a.hasSlip),
      note: text(a.note),
    })),
  }));
}

/** A transfer's slip is stored first; the advance then names it. */
export async function uploadAdvanceSlip(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  period: string,
  photo: Blob,
): Promise<string> {
  const res = await fetchFn(one(base, id, `/advance-slip?period=${period}`), {
    method: "POST",
    headers: imageHeaders(token, photo),
    body: photo,
  });
  if (!res.ok) throw await refused(res, "Slip was not saved");
  return String(((await res.json()) as { key?: unknown }).key ?? "");
}

export interface NewAdvance {
  period: string;
  givenOn: string;
  amountSatang: number;
  method: "transfer" | "cash";
  slipKey: string | null;
  note: string | null;
  paidBy?: string;
}

export async function recordAdvance(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  advance: NewAdvance,
): Promise<void> {
  await send(fetchFn, one(base, id, "/advances"), token, "POST", advance, "Advance not saved");
}

export interface DayOff {
  id: string;
  userId: string;
  /** "2026-10-28". */
  day: string;
  halves: number;
  reason: string | null;
  name: string;
  role: string;
}

function dayOff(r: Raw): DayOff {
  return {
    id: String(r.id),
    userId: String(r.userId ?? ""),
    day: String(r.day ?? ""),
    halves: num(r.halves) ?? 2,
    reason: text(r.reason),
    name: text(r.nameTh) ?? String(r.name ?? ""),
    role: String(r.role ?? ""),
  };
}

/** Everyone's days off in a month; one person's when `of` is given. */
export async function fetchDaysOff(
  fetchFn: FetchFn,
  base: string,
  token: string,
  month: string,
  of?: string,
): Promise<DayOff[]> {
  const url = of
    ? one(base, of, `/days-off?month=${month}`)
    : `${base}/staff/days-off?month=${month}`;
  const body = await readJson<{ days?: Raw[] }>(fetchFn, url, token, "Days off failed to load");
  return (body.days ?? []).map(dayOff);
}

export interface DayOffInput {
  day: string;
  halves: number;
  reason: string;
}

export async function recordDayOff(
  fetchFn: FetchFn,
  base: string,
  token: string,
  userId: string,
  input: DayOffInput,
): Promise<void> {
  await send(fetchFn, one(base, userId, "/day-off"), token, "POST", input, "Day off not saved");
}

export async function updateDayOff(
  fetchFn: FetchFn,
  base: string,
  token: string,
  dayOffId: string,
  input: DayOffInput,
): Promise<void> {
  const url = `${base}/staff/days-off/${encodeURIComponent(dayOffId)}`;
  await send(fetchFn, url, token, "PATCH", input, "Day off not saved");
}

export async function deleteDayOff(fetchFn: FetchFn, base: string, token: string, id: string) {
  await remove(fetchFn, `${base}/staff/days-off/${encodeURIComponent(id)}`, token, "Not deleted");
}

export interface ActivityRow {
  id: string;
  kind: string;
  detail: string | null;
  createdAt: number;
  userId: string;
  name: string;
}

/** ประวัติ: everyone's or one person's, for a month. */
export async function fetchActivity(
  fetchFn: FetchFn,
  base: string,
  token: string,
  q: { person: string | null; month: string },
): Promise<ActivityRow[]> {
  const query = new URLSearchParams();
  if (q.person) query.set("person", q.person);
  query.set("month", q.month);
  const body = await readJson<{ activity?: Raw[] }>(
    fetchFn,
    `${base}/staff/activity?${query}`,
    token,
    "History failed to load",
  );
  return (body.activity ?? []).map((r) => ({
    id: String(r.id),
    kind: String(r.kind ?? ""),
    detail: text(r.detail),
    createdAt: num(r.createdAt) ?? 0,
    userId: String(r.userId ?? ""),
    name: text(r.nameTh) ?? String(r.name ?? ""),
  }));
}

import { failure, sendJson, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/**
 * โปรไฟล์ของฉัน's calls: the /staff/me routes, open to everyone for their own account (unlike
 * teamApi's, which are the owner's). Their refusals are plain English sentences with a status, kept
 * as OwnRefusal so the sheet can show the drawn words (lib/profilePage refusedWords).
 */
export class OwnRefusal extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface OwnProfile {
  id: string;
  name: string;
  nameTh: string | null;
  nameEn: string | null;
  fullNameTh: string | null;
  fullNameEn: string | null;
  email: string | null;
  /** super_admin, admin or mechanic. */
  role: string;
  phone: string | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  startedOn: number | null;
  dayRateSatang: number | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  /** Your current password and PIN, readable (the server keeps a sealed copy for this). */
  password: string | null;
  pin: string | null;
  hasPin: boolean;
  hasPassword: boolean;
  hasRecoveryKey: boolean;
  recoverySetAt: number | null;
}

export interface OwnDayOff {
  id: string;
  /** "2026-11-03". */
  day: string;
  halves: number;
  reason: string | null;
}

type Raw = Record<string, unknown>;
const yes = (v: unknown) => v === true || v === 1;
const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

const me = (base: string, rest: string) => `${base}/staff/me${rest}`;

async function refusal(res: Response): Promise<OwnRefusal> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  return new OwnRefusal(res.status, typeof body.error === "string" ? body.error : "");
}

async function send(fetchFn: FetchFn, url: string, init: RequestInit): Promise<void> {
  const res = await fetchFn(url, init);
  if (!res.ok) throw await refusal(res);
}

export async function fetchOwnProfile(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<OwnProfile> {
  const res = await fetchFn(me(base, "/profile"), { headers: session(token) });
  if (!res.ok) throw await failure(res, "Profile failed to load");
  const r = ((await res.json()) as { profile?: Raw }).profile ?? {};
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    nameTh: text(r.nameTh),
    nameEn: text(r.nameEn),
    fullNameTh: text(r.fullNameTh),
    fullNameEn: text(r.fullNameEn),
    email: text(r.email),
    role: String(r.role ?? ""),
    phone: text(r.phone),
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
    hasRecoveryKey: yes(r.hasRecoveryKey),
    recoverySetAt: num(r.recoverySetAt),
  };
}

const CODE_ROUTE = {
  password: { path: "/password", field: "password" },
  pin: { path: "/pin", field: "pin" },
  key: { path: "/recovery-key", field: "key" },
} as const;

/** Set your own password, 6-digit code or (the owner) emergency key. You stay signed in. */
export async function saveOwnCode(
  fetchFn: FetchFn,
  base: string,
  token: string,
  kind: keyof typeof CODE_ROUTE,
  value: string,
): Promise<void> {
  const { path, field } = CODE_ROUTE[kind];
  await send(fetchFn, me(base, path), sendJson(token, { [field]: value }));
}

/** เอากุญแจออก: the emailed sign-in stays, so the owner is never left without a way back. */
export async function removeOwnKey(fetchFn: FetchFn, base: string, token: string): Promise<void> {
  await send(fetchFn, me(base, "/recovery-key"), { method: "DELETE", headers: session(token) });
}

export async function fetchOwnDaysOff(
  fetchFn: FetchFn,
  base: string,
  token: string,
  month: string,
): Promise<OwnDayOff[]> {
  const res = await fetchFn(me(base, `/days-off?month=${month}`), { headers: session(token) });
  if (!res.ok) throw await failure(res, "Days off failed to load");
  const body = (await res.json()) as { days?: Raw[] };
  return (body.days ?? []).map((r) => ({
    id: String(r.id),
    day: String(r.day ?? ""),
    halves: num(r.halves) ?? 2,
    reason: text(r.reason),
  }));
}

export async function recordOwnDayOff(
  fetchFn: FetchFn,
  base: string,
  token: string,
  input: { day: string; halves: number; reason: string },
): Promise<void> {
  await send(fetchFn, me(base, "/day-off"), sendJson(token, input));
}

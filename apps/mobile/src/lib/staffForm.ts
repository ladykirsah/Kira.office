import { startOfDay } from "./orderList";
import { parseBaht } from "./productEdit";
import type { NewStaff, StaffProfile } from "./teamApi";

/**
 * เพิ่มคน and แก้ไข's boxes (canvas v292, 1.2 · 3.6): ชื่อ, ติดต่อ, ผู้ติดต่อฉุกเฉิน, งาน, บัญชีธนาคาร,
 * and on เพิ่มคน the two codes. The server keeps the start day as midnight UTC of that day.
 */
export interface PersonDraft {
  nameTh: string;
  nameEn: string;
  fullNameTh: string;
  fullNameEn: string;
  phone: string;
  email: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  role: string;
  /** Baht as typed. */
  dayRate: string;
  /** The day on the phone (local midnight). */
  startedOn: number | null;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  password: string;
  pin: string;
}

const TEXT_KEYS = [
  "nameTh",
  "nameEn",
  "fullNameTh",
  "fullNameEn",
  "phone",
  "email",
  "emergencyName",
  "emergencyRelation",
  "emergencyPhone",
  "bankName",
  "bankAccountNo",
  "bankAccountName",
] as const;

type TextKey = (typeof TEXT_KEYS)[number];

/** A new person: a mechanic who starts today. */
export function blankDraft(now: number): PersonDraft {
  const empty = Object.fromEntries(TEXT_KEYS.map((k) => [k, ""])) as Record<TextKey, string>;
  return {
    ...empty,
    role: "mechanic",
    dayRate: "",
    startedOn: startOfDay(now),
    password: "",
    pin: "",
  };
}

/** Local midnight → the server's midnight UTC of the same day, and back. */
const toServerDay = (local: number) => {
  const d = new Date(local);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};
const fromServerDay = (utc: number) => {
  const d = new Date(utc);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
};

/** POST /staff: what was filled, trimmed; blank boxes left out. */
export function newStaffBody(d: PersonDraft): NewStaff {
  const body: NewStaff = {};
  for (const k of TEXT_KEYS) {
    const v = d[k].trim();
    if (v) body[k] = v;
  }
  body.role = d.role;
  const rate = parseBaht(d.dayRate);
  if (rate) body.dayRateSatang = rate;
  if (d.startedOn != null) body.startedOn = toServerDay(d.startedOn);
  if (d.password.trim()) body.password = d.password.trim();
  if (d.pin.trim()) body.pin = d.pin.trim();
  return body;
}

/** A person read back into the boxes (the codes stay out: they have their own sheets). */
export function draftOf(p: StaffProfile): PersonDraft {
  const text = Object.fromEntries(TEXT_KEYS.map((k) => [k, p[k] ?? ""])) as Record<TextKey, string>;
  return {
    ...text,
    role: p.role,
    dayRate: p.dayRateSatang == null ? "" : String(p.dayRateSatang / 100),
    startedOn: p.startedOn == null ? null : fromServerDay(p.startedOn),
    password: "",
    pin: "",
  };
}

/** PATCH /staff/:id/profile: only what changed; an emptied box sends null, which clears it. */
export function profileChanges(
  p: StaffProfile,
  d: PersonDraft,
): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const k of TEXT_KEYS) {
    const v = d[k].trim();
    if (v !== (p[k] ?? "")) out[k] = v || null;
  }
  const rate = d.dayRate.trim() ? parseBaht(d.dayRate) : null;
  if (rate !== p.dayRateSatang) out.dayRateSatang = rate;
  const day = d.startedOn == null ? null : toServerDay(d.startedOn);
  if (day !== p.startedOn) out.startedOn = day;
  return out;
}

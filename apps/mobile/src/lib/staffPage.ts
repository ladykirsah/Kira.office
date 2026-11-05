import type { Phrase } from "@l-shopee/shared/lang";
import { LEAVE_MODES, leaveModePhrase, pinProblem, slipExpiresAt } from "@l-shopee/core";
import { initials } from "./initials";
import { formatBaht } from "./money";
import {
  MONTHS_EN,
  MONTHS_TH,
  clockTime,
  dayPill,
  parseDayField,
  shortDate,
  startOfDay,
} from "./orderList";

/**
 * The words and sums behind พนักงาน (owner approved the drawing, canvas v292, 2 Nov 2026): the
 * people, their pay by the day, advances, days off and what happened. No screen code here. Money is
 * satang; a day is two halves, the way payroll counts it.
 */

/** One person, as GET /staff lists them. */
export interface StaffPerson {
  id: string;
  /** The account name; the Thai nickname is shown when there is one. */
  name: string;
  nameTh: string | null;
  nameEn: string | null;
  /** super_admin, admin or mechanic. */
  role: string;
  /** active or disabled (เปิดใช้ off). */
  status: string;
  lastLoginAt: number | null;
  lockedUntil: number | null;
  phone: string | null;
  hasPhoto: boolean;
}

/** One person's line in a month of GET /staff/salary. */
export interface PayRow {
  userId: string;
  name: string;
  role: string;
  dayRateSatang: number;
  workingHalves: number;
  offHalves: number;
  /** The month's whole pay: rate × days worked. */
  amountSatang: number;
  /** Advances already given against this month. */
  advanceSatang: number;
  /** What payday hands over: the whole pay less the advances. */
  dueSatang: number;
  paidAt: number | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  hasSlip: boolean;
}

export interface Advance {
  id: string;
  /** "2026-08-12" — the day the money was handed over. */
  givenOn: string;
  amountSatang: number;
  /** transfer or cash. */
  method: string;
  hasSlip: boolean;
  note: string | null;
}

/** One month of a person's pay history, GET /staff/:id/payments. */
export interface PaymentMonth {
  period: string;
  dayRateSatang: number;
  offHalves: number;
  workingHalves: number;
  earnedSatang: number;
  advanceSatang: number;
  dueSatang: number;
  owedSatang: number;
  paidAt: number | null;
  method: string | null;
  hasSlip: boolean;
  paidBy: string | null;
  advances: Advance[];
}

const ROLES: Record<string, Phrase> = {
  super_admin: { th: "เจ้าของร้าน", en: "Owner" },
  admin: { th: "ผู้ดูแล", en: "Admin" },
  mechanic: { th: "ช่าง", en: "Mechanic" },
};

/** The positions in the order the form offers them. */
export const ROLE_KEYS = ["super_admin", "admin", "mechanic"] as const;

export function roleWord(role: string): Phrase {
  return ROLES[role] ?? { th: role, en: role };
}

export function shownName(p: Pick<StaffPerson, "name" | "nameTh">): string {
  return p.nameTh?.trim() || p.name;
}

const join = (a: Phrase, b: Phrase, sep = " · "): Phrase => ({
  th: `${a.th}${sep}${b.th}`,
  en: `${a.en}${sep}${b.en}`,
});

/** "วันนี้ 08:41", "เมื่อวาน 17:30", "27 ต.ค.", or with the Thai year for another year. */
export function seenWhen(ms: number, now: number): Phrase {
  const day = startOfDay(ms);
  const today = startOfDay(now);
  const time = clockTime(ms);
  if (day === today) return { th: `วันนี้ ${time}`, en: `today ${time}` };
  if (day === startOfDay(today - 1)) return { th: `เมื่อวาน ${time}`, en: `yesterday ${time}` };
  if (new Date(ms).getFullYear() === new Date(now).getFullYear()) return shortDate(ms);
  return dayPill(ms);
}

export function seenLine(ms: number | null, now: number): Phrase {
  if (ms == null) return { th: "ยังไม่เคยเข้าใช้", en: "Never signed in" };
  const when = seenWhen(ms, now);
  return { th: `เข้าใช้ ${when.th}`, en: `Signed in ${when.en}` };
}

/** A person's line in the list: position and last sign-in, or ปิดอยู่ with a dot when switched off. */
export function personLine(p: StaffPerson, now: number): { dot: "off" | null; text: Phrase } {
  const seen = seenLine(p.lastLoginAt, now);
  if (p.status !== "active") return { dot: "off", text: join({ th: "ปิดอยู่", en: "Off" }, seen) };
  return { dot: null, text: join(roleWord(p.role), seen) };
}

export type AccessDot = "red" | "grey" | "green";

/** การเข้าใช้งาน · สถานะ on a person's page. */
export function accessState(p: StaffPerson, now: number): { dot: AccessDot; text: Phrase } {
  if (p.status !== "active") return { dot: "grey", text: { th: "ปิดอยู่", en: "Off" } };
  if (p.lockedUntil != null && p.lockedUntil > now) {
    const day = startOfDay(p.lockedUntil);
    const time = clockTime(p.lockedUntil);
    const today = startOfDay(now);
    const until: Phrase =
      day === today
        ? { th: `วันนี้ ${time}`, en: `today ${time}` }
        : day === startOfDay(today + 36 * 3_600_000)
          ? { th: `พรุ่งนี้ ${time}`, en: `tomorrow ${time}` }
          : {
              th: ` ${shortDate(p.lockedUntil).th} ${time}`,
              en: `${shortDate(p.lockedUntil).en} ${time}`,
            };
    return { dot: "red", text: { th: `ล็อกอยู่ ถึง${until.th}`, en: `Locked until ${until.en}` } };
  }
  return { dot: "green", text: { th: "เข้าใช้ได้", en: "Can sign in" } };
}

/** "2026-10" → "ต.ค. 2569". */
export function monthLabel(period: string): Phrase {
  const [y = "0", m = "1"] = period.split("-");
  const i = Number(m) - 1;
  return { th: `${MONTHS_TH[i]} ${Number(y) + 543}`, en: `${MONTHS_EN[i]} ${y}` };
}

const PAID: Phrase = { th: "จ่ายแล้ว", en: "Paid" };
const TO_PAY: Phrase = { th: "ที่ต้องจ่าย", en: "To pay" };
const NO_ADVANCE: Phrase = { th: "ยังไม่เบิก", en: "No advance yet" };

/** A salary row: the month's whole pay, then the day it was paid or what is left to do. */
export function salaryLine(r: PayRow): Phrase {
  const amount = formatBaht(r.amountSatang);
  const state = payState(r);
  return { th: `${amount} · ${state.th}`, en: `${amount} · ${state.en}` };
}

/**
 * Card C on เงินเดือน. Advances already handed over count as paid, so จ่ายแล้ว + ที่ต้องจ่าย always
 * add up to the month's total.
 */
export function monthSummary(rows: readonly PayRow[]): {
  total: string;
  count: Phrase;
  split: Phrase;
} {
  let total = 0;
  let paid = 0;
  let due = 0;
  let paidPeople = 0;
  for (const r of rows) {
    total += r.amountSatang;
    if (r.paidAt == null) {
      paid += r.advanceSatang;
      due += r.dueSatang;
    } else {
      paid += r.amountSatang;
      paidPeople += 1;
    }
  }
  return {
    total: formatBaht(total),
    count: {
      th: `จ่ายไป ${paidPeople} จาก ${rows.length} คน`,
      en: `Paid ${paidPeople} of ${rows.length}`,
    },
    split: {
      th: `จ่ายแล้ว ${formatBaht(paid)} · ที่ต้องจ่าย ${formatBaht(due)}`,
      en: `Paid ${formatBaht(paid)} · To pay ${formatBaht(due)}`,
    },
  };
}

/** Halves of a day as days: "30 วัน", "29½ วัน", "½ วัน". */
export function daysWord(halves: number): Phrase {
  const whole = Math.floor(halves / 2);
  const half = halves % 2 === 1 ? "½" : "";
  const n = whole === 0 && half ? half : `${whole}${half}`;
  return { th: `${n} วัน`, en: `${n} ${halves === 2 || halves === 1 ? "day" : "days"}` };
}

/** The pay sheet's head: what payday hands over, whose month, and how it came to that. */
export function payHead(r: PayRow, period: string): { amount: string; who: Phrase; how: Phrase } {
  const month = monthLabel(period);
  const how: Phrase =
    r.advanceSatang > 0
      ? {
          th: `${formatBaht(r.amountSatang)} − เบิกแล้ว ${formatBaht(r.advanceSatang)}`,
          en: `${formatBaht(r.amountSatang)} − advanced ${formatBaht(r.advanceSatang)}`,
        }
      : {
          th: `${formatBaht(r.dayRateSatang)} × ${daysWord(r.workingHalves).th} · ${NO_ADVANCE.th}`,
          en: `${formatBaht(r.dayRateSatang)} × ${daysWord(r.workingHalves).en} · ${NO_ADVANCE.en}`,
        };
  return {
    amount: formatBaht(r.dueSatang),
    who: { th: `${r.name} · เงินเดือน ${month.th}`, en: `${r.name} · Salary ${month.en}` },
    how,
  };
}

/** A person's line when picking who takes an advance; a month already paid can't take one. */
export function advancePick(r: PayRow): { text: Phrase; open: boolean } {
  if (r.paidAt != null) {
    return {
      text: { th: "จ่ายครบแล้ว · เบิกไม่ได้", en: "Paid in full · No advance" },
      open: false,
    };
  }
  if (r.advanceSatang > 0) {
    const amount = formatBaht(r.advanceSatang);
    return { text: { th: `เบิกแล้ว ${amount}`, en: `Advanced ${amount}` }, open: true };
  }
  return { text: NO_ADVANCE, open: true };
}

/** The year card on a person's เงินเดือน page, added up the way the month card is. */
export function yearSummary(months: readonly PaymentMonth[]): {
  total: string;
  paid: string;
  due: string;
} {
  let total = 0;
  let paid = 0;
  let due = 0;
  for (const m of months) {
    total += m.earnedSatang;
    if (m.paidAt == null) {
      paid += m.advanceSatang;
      due += m.dueSatang;
    } else paid += m.earnedSatang;
  }
  return { total: formatBaht(total), paid: formatBaht(paid), due: formatBaht(due) };
}

/** A month in the pay history list. */
export function historyLine(m: PaymentMonth): { sub: Phrase; amount: string } {
  return {
    sub: m.paidAt == null ? TO_PAY : join(shortDate(m.paidAt), PAID),
    amount: formatBaht(m.earnedSatang),
  };
}

/** A month under เงินเดือน on a person's page. */
export function personPayLine(m: PaymentMonth): Phrase {
  const state = m.paidAt == null ? TO_PAY : PAID;
  const amount = formatBaht(m.earnedSatang);
  return { th: `${state.th} ${amount}`, en: `${state.en} ${amount}` };
}

/** A month record's head: paid in full (and in how many payments), or what is left to do. */
export function recordHead(m: PaymentMonth): Phrase {
  if (m.paidAt == null) return TO_PAY;
  const times = m.advances.length + 1;
  return times > 1
    ? { th: `จ่ายครบแล้ว · ${times} ครั้ง`, en: `Paid in full · ${times} payments` }
    : { th: "จ่ายครบแล้ว", en: "Paid in full" };
}

const METHODS: Record<string, Phrase> = {
  transfer: { th: "โอน", en: "Transfer" },
  cash: { th: "เงินสด", en: "Cash" },
};

function methodWord(method: string | null): Phrase {
  return METHODS[method ?? ""] ?? { th: method ?? "", en: method ?? "" };
}

export type SlipRef = { kind: "salary"; period: string } | { kind: "advance"; id: string };

export interface PaymentLine {
  key: string;
  when: Phrase;
  how: Phrase;
  amount: string;
  slip: SlipRef | null;
}

/** การจ่าย on a month record: each advance by its day, then payday with the rest. */
export function paymentLines(m: PaymentMonth): PaymentLine[] {
  const advances = [...m.advances]
    .sort((a, b) => a.givenOn.localeCompare(b.givenOn))
    .map((a): PaymentLine => ({
      key: a.id,
      when: dayPill(parseDayField(a.givenOn)),
      how: join({ th: "เงินเบิก", en: "Advance" }, methodWord(a.method)),
      amount: formatBaht(a.amountSatang),
      slip: a.hasSlip ? { kind: "advance", id: a.id } : null,
    }));
  if (m.paidAt == null) return advances;
  return [
    ...advances,
    {
      key: "payday",
      when: join(dayPill(m.paidAt), { th: clockTime(m.paidAt), en: clockTime(m.paidAt) }),
      how: join({ th: "เงินเดือน", en: "Salary" }, methodWord(m.method)),
      amount: formatBaht(m.dueSatang),
      slip: m.hasSlip ? { kind: "salary", period: m.period } : null,
    },
  ];
}

/**
 * Payday's slip photo: kept, or gone — the system deletes it three calendar months after payday
 * (owner, 2026-08-04) while the payslip stays. A transfer always had one; cash may not have.
 */
export function slipState(m: PaymentMonth, now: number): "kept" | "gone" | "none" {
  if (m.paidAt == null) return "none";
  if (m.hasSlip) return "kept";
  return m.method === "transfer" && now >= slipExpiresAt(m.paidAt) ? "gone" : "none";
}

function slipUntil(m: PaymentMonth): Phrase {
  return dayPill(m.paidAt == null ? null : slipExpiresAt(m.paidAt));
}

/** Under a kept wage slip. */
export function slipNote(m: PaymentMonth): Phrase {
  const until = slipUntil(m);
  return {
    th: `ระบบเก็บรูปสลิปไว้ 3 เดือน ถึง ${until.th} · บันทึกลงเครื่องไว้ถ้าต้องเก็บนานกว่านั้น`,
    en: `Slip photos are kept 3 months, until ${until.en} · Save it to the phone to keep it longer`,
  };
}

/** In the card where a deleted wage slip was. */
export function slipGoneNote(m: PaymentMonth): Phrase {
  const until = slipUntil(m);
  return {
    th: `ระบบเก็บรูปสลิปไว้ 3 เดือน ถึง ${until.th}`,
    en: `Slip photos are kept 3 months, until ${until.en}`,
  };
}

const WEEKDAYS: readonly Phrase[] = [
  { th: "อาทิตย์", en: "Sun" },
  { th: "จันทร์", en: "Mon" },
  { th: "อังคาร", en: "Tue" },
  { th: "พุธ", en: "Wed" },
  { th: "พฤหัสบดี", en: "Thu" },
  { th: "ศุกร์", en: "Fri" },
  { th: "เสาร์", en: "Sat" },
];

/** "2026-10-28" → "28 ต.ค. · พุธ". */
export function dayOffTitle(day: string): Phrase {
  const ms = parseDayField(day) ?? 0;
  return join(shortDate(ms), WEEKDAYS[new Date(ms).getDay()] ?? { th: "", en: "" });
}

/** เต็มวัน / ครึ่งวัน; เข้าสาย for late records the old back office wrote. */
export function halvesWord(halves: number): Phrase {
  return leaveModePhrase(halves === 0 || halves === 1 ? halves : 2);
}

/** A run of history rows sits under "วันนี้ · 29 ต.ค.", "เมื่อวาน · 28 ต.ค." or the date. */
export function dayHeading(ms: number, now: number): Phrase {
  const day = startOfDay(ms);
  const today = startOfDay(now);
  if (day === today) return join({ th: "วันนี้", en: "Today" }, shortDate(ms));
  if (day === startOfDay(today - 1))
    return join({ th: "เมื่อวาน", en: "Yesterday" }, shortDate(ms));
  return shortDate(ms);
}

const dash = (head: Phrase, tail: Phrase): Phrase => join(head, tail, " — ");

/** "2026-10-28" in a stored note → "28 ต.ค."; anything else is kept as it is. */
function noteDay(text: string): Phrase {
  const ms = parseDayField(text);
  return ms == null ? { th: text, en: text } : shortDate(ms);
}

/** "เอก · 2026-10 · 11,725 บาท" → "เอก ต.ค. 2569 ฿11,725". */
function notePay(detail: string): Phrase {
  const [who = "", period = "", money = ""] = detail.split(" · ");
  const month = /^\d{4}-\d{2}$/.test(period) ? monthLabel(period) : { th: period, en: period };
  const amount = money.replace(/^([\d,.]+) บาท$/, "฿$1");
  return { th: `${who} ${month.th} ${amount}`, en: `${who} ${month.en} ${amount}` };
}

/** "2026-10-28 · เต็มวัน" → "28 ต.ค. เต็มวัน". */
function noteDayOff(detail: string): Phrase {
  const [day = "", mode = ""] = detail.split(" · ");
  const when = noteDay(day);
  const found = LEAVE_MODES.find((m) => m.th === mode);
  return { th: `${when.th} ${mode}`, en: `${when.en} ${found ? found.en.toLowerCase() : mode}` };
}

const FIXED: Record<string, Phrase> = {
  password_changed: { th: "เปลี่ยนรหัสผ่านของตัวเอง", en: "Changed their password" },
  pin_changed: { th: "เปลี่ยนรหัส 6 หลักของตัวเอง", en: "Changed their PIN" },
  profile_edited: { th: "แก้ไขข้อมูลของตัวเอง", en: "Updated their profile" },
  locked: { th: "เข้าใช้งานผิด 3 ครั้ง — ล็อก", en: "3 failed sign-ins — locked" },
  recovery_login: {
    th: "เข้าใช้งานผ่านทางเข้าฉุกเฉิน",
    en: "Signed in through the emergency entrance",
  },
  recovery_key_set: { th: "ตั้งกุญแจฉุกเฉินใหม่", en: "Set a new emergency key" },
  recovery_key_cleared: { th: "ลบกุญแจฉุกเฉิน", en: "Removed the emergency key" },
};

/** Notes the server writes in English about someone else, with the Thai they read as. */
const ABOUT_SOMEONE: Record<string, { pattern: RegExp; th: (who: string) => string }> = {
  pin_changed: { pattern: /^Reset the PIN for (.+)$/, th: (who) => `ตั้งรหัส 6 หลักใหม่ให้${who}` },
  pin_cleared: { pattern: /^Cleared the PIN for (.+)$/, th: (who) => `ล้างรหัส 6 หลักของ${who}` },
  profile_edited: { pattern: /^Edited (.+)’s profile$/, th: (who) => `แก้ไขข้อมูลของ${who}` },
};

const HEADS: Record<string, { head: Phrase; read: (d: string) => Phrase }> = {
  day_off: { head: { th: "บันทึกวันหยุด", en: "Recorded a day off" }, read: noteDayOff },
  day_off_edit: { head: { th: "แก้ไขวันหยุด", en: "Edited a day off" }, read: noteDayOff },
  day_off_delete: {
    head: { th: "ลบวันหยุด", en: "Deleted a day off" },
    read: (d) => {
      const [day = "", who = ""] = d.split(" · ");
      const when = noteDay(day);
      return who ? { th: `${when.th} ของ${who}`, en: `${when.en}, ${who}` } : when;
    },
  },
  salary_paid: { head: { th: "จ่ายเงินเดือน", en: "Paid salary" }, read: notePay },
  advance_recorded: { head: { th: "บันทึกเงินเบิก", en: "Recorded an advance" }, read: notePay },
  advance_deleted: { head: { th: "ลบเงินเบิก", en: "Deleted an advance" }, read: notePay },
};

/** What a history row says, from the event's kind and the note the server stored with it. */
export function activityText(kind: string, detail: string | null): Phrase {
  const about = ABOUT_SOMEONE[kind];
  const who = detail == null ? null : about?.pattern.exec(detail)?.[1];
  if (about && who != null) return { th: about.th(who), en: detail ?? "" };
  const withNote = HEADS[kind];
  if (withNote) return detail ? dash(withNote.head, withNote.read(detail)) : withNote.head;
  const fixed = FIXED[kind];
  if (fixed) return fixed;
  const text = detail ?? kind;
  return { th: text, en: text };
}

export interface AddForm {
  nameTh: string;
  phone: string;
  email: string;
  pin: string;
}

export type AddProblems = Partial<Record<"nameTh" | "phone" | "pin", Phrase>>;

/**
 * บันทึก on เพิ่มคน names only the boxes still empty. Without an email the 6-digit code is the
 * only way in, so then it counts as a box to fill. Anything the server refuses shows under its box.
 */
export function addProblems(f: AddForm): AddProblems {
  const out: AddProblems = {};
  if (!f.nameTh.trim()) out.nameTh = { th: "ยังไม่ได้ใส่ชื่อเล่น", en: "No nickname yet" };
  if (!f.phone.trim()) out.phone = { th: "ยังไม่ได้ใส่เบอร์โทร", en: "No phone number yet" };
  if (!f.email.trim() && !f.pin.trim()) {
    out.pin = { th: "ยังไม่ได้ใส่รหัส 6 หลัก", en: "No 6-digit code yet" };
  }
  return out;
}

/** Random bytes; the phone passes expo-crypto's, tests and the web use the browser's. */
export type RandomBytes = (n: number) => Uint8Array;
const webBytes: RandomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** The old back office's alphabet: no 0/O, 1/l/I look-alikes. */
const PASSWORD_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PASSWORD_LENGTH = 14;

/** Characters drawn evenly from an alphabet: bytes past the last whole multiple are thrown away. */
function draw(alphabet: string, length: number, bytes: RandomBytes): string {
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < length) {
    for (const b of bytes(length * 2)) {
      if (b < limit && out.length < length) out += alphabet[b % alphabet.length];
    }
  }
  return out;
}

/** สุ่มให้ next to รหัสผ่าน. */
export function randomPassword(bytes: RandomBytes = webBytes): string {
  return draw(PASSWORD_ALPHABET, PASSWORD_LENGTH, bytes);
}

/** สุ่มให้ next to รหัส 6 หลัก: six digits the server takes (no 111111 or 123456). */
export function randomPin(bytes: RandomBytes = webBytes): string {
  for (;;) {
    const pin = draw("0123456789", 6, bytes);
    if (pinProblem(pin) == null) return pin;
  }
}

const REFUSALS: Record<string, Phrase> = {
  name_th_required: { th: "ยังไม่ได้ใส่ชื่อเล่น", en: "No nickname yet" },
  phone_required: { th: "ยังไม่ได้ใส่เบอร์โทร", en: "No phone number yet" },
  email_taken: { th: "อีเมลนี้มีบัญชีแล้ว", en: "That email already has an account" },
  email_invalid: { th: "อีเมลไม่ถูกต้อง", en: "That email is not valid" },
  password_too_short: { th: "รหัสผ่านอย่างน้อย 8 ตัว", en: "At least 8 characters" },
  password_without_email: {
    th: "ไม่มีอีเมล ใช้รหัสผ่านไม่ได้",
    en: "No email, so no password",
  },
  pin_required_without_email: { th: "ยังไม่ได้ใส่รหัส 6 หลัก", en: "No 6-digit code yet" },
  pin_format: { th: "ตัวเลข 6 ตัว", en: "6 digits" },
  pin_too_easy: { th: "รหัสนี้เดาง่าย เลือกใหม่", en: "Too easy to guess. Choose another" },
  pin_taken: { th: "มีคนใช้รหัสนี้แล้ว เลือกใหม่", en: "Someone uses this code. Choose another" },
  pin_unavailable: { th: "ตั้งรหัส 6 หลักไม่ได้ตอนนี้", en: "Codes can't be set right now" },
  photo_type: { th: "รูปต้องเป็น JPG หรือ PNG", en: "Use a JPG or PNG" },
  photo_too_large: { th: "รูปใหญ่เกิน 5MB", en: "The photo is over 5MB" },
};

/** What a refused box says: the drawn words, or the server's own sentence for anything new. */
export function refusalWords(code: string, message: string): Phrase {
  return REFUSALS[code] ?? { th: message, en: message };
}

const periodOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** "2026-10" — the month the phone is in (the shop is in Bangkok, and so is the phone). */
export function thisMonth(now: number): string {
  return periodOf(new Date(now));
}

/** The month menus: this month first, then the ones before it. */
export function recentMonths(now: number, count: number): string[] {
  const d = new Date(now);
  return Array.from({ length: count }, (_, i) =>
    periodOf(new Date(d.getFullYear(), d.getMonth() - i, 1)),
  );
}

/** Thai consonants ก–ฮ; vowels, tone marks and the leading vowels are not. */
const THAI_CONSONANT = /[\u0E01-\u0E2E]/g;

/**
 * The letters in a person's round badge. A one-word Thai nickname shows its first and last
 * consonant (น้องนุ่น → นน, as the drawings do); anything else is the account badge's rule.
 */
export function badgeLetters(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const consonants = words.length === 1 ? (words[0]!.match(THAI_CONSONANT) ?? []) : [];
  if (consonants.length >= 2) return `${consonants[0]}${consonants[consonants.length - 1]}`;
  return initials(name);
}

/** คน's order: the owners, then everyone in Thai name order, and anyone switched off last. */
export function teamOrder<T extends StaffPerson>(people: readonly T[]): T[] {
  const rank = (p: StaffPerson) => (p.status !== "active" ? 2 : p.role === "super_admin" ? 0 : 1);
  return [...people].sort(
    (a, b) => rank(a) - rank(b) || shownName(a).localeCompare(shownName(b), "th"),
  );
}

/**
 * The grey line on the owner's locked account (พนักงาน 8, owner 4 Nov 2026: "Yes, all three"): the
 * server refuses to delete it, switch it off or change its role.
 */
export const OWNER_LOCK_LINE: Phrase = {
  th: "บัญชีเจ้าของร้าน · ลบ ปิดใช้ หรือเปลี่ยนตำแหน่งไม่ได้",
  en: "Owner's account · can't be deleted, switched off or given another role",
};

/** ลบคนนี้ shows only where it can work: never on the locked owner, never on your own page. */
export const showsDelete = (p: { id: string; locked: boolean }, me: string): boolean =>
  !p.locked && p.id !== me;

/** คน's เข้าใช้ล่าสุด column on a computer (DeskStaff, 5 Nov 2026): the day only, never a clock time. */
export function lastSeenDay(ms: number | null, now: number): Phrase {
  if (ms == null) return { th: "ยังไม่เคย", en: "Never" };
  const day = startOfDay(ms);
  const today = startOfDay(now);
  if (day === today) return { th: "วันนี้", en: "Today" };
  if (day === startOfDay(today - 1)) return { th: "เมื่อวาน", en: "Yesterday" };
  if (new Date(ms).getFullYear() === new Date(now).getFullYear()) return shortDate(ms);
  return dayPill(ms);
}

/** คน's ตำแหน่ง column: the position, or ปิดอยู่ with its grey dot for someone switched off. */
export function positionWord(p: StaffPerson): { dot: "off" | null; text: Phrase } {
  if (p.status !== "active") return { dot: "off", text: { th: "ปิดอยู่", en: "Off" } };
  return { dot: null, text: roleWord(p.role) };
}

/** เงินเดือน's การจ่าย column: the day it was paid, or what is left to do. */
export function payState(r: PayRow): Phrase {
  return r.paidAt == null ? TO_PAY : join(shortDate(r.paidAt), PAID);
}

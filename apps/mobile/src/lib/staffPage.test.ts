import { describe, expect, it } from "vitest";
import {
  accessState,
  badgeLetters,
  activityText,
  addProblems,
  advancePick,
  dayHeading,
  dayOffTitle,
  daysWord,
  halvesWord,
  historyLine,
  monthLabel,
  monthSummary,
  payHead,
  paymentLines,
  personLine,
  personPayLine,
  randomPassword,
  randomPin,
  recordHead,
  recentMonths,
  refusalWords,
  roleWord,
  salaryLine,
  seenLine,
  shownName,
  slipGoneNote,
  slipNote,
  slipState,
  teamOrder,
  thisMonth,
  yearSummary,
  type PayRow,
  type PaymentMonth,
  type StaffPerson,
  OWNER_LOCK_LINE,
  showsDelete,
} from "./staffPage";

const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const NOW = at(2026, 10, 29, 10, 0);

const person = (over: Partial<StaffPerson> = {}): StaffPerson => ({
  id: "u-boy",
  name: "บอย",
  nameTh: "บอย",
  nameEn: "Boy",
  role: "mechanic",
  status: "active",
  lastLoginAt: at(2026, 10, 28, 17, 30),
  lockedUntil: null,
  phone: "0815555512",
  hasPhoto: false,
  ...over,
});

const row = (over: Partial<PayRow> = {}): PayRow => ({
  userId: "u-eak",
  name: "เอก",
  role: "mechanic",
  dayRateSatang: 45_000,
  workingHalves: 61,
  offHalves: 1,
  amountSatang: 1_372_500,
  advanceSatang: 200_000,
  dueSatang: 1_172_500,
  paidAt: null,
  bankName: "กสิกร",
  bankAccountNo: "098-7-65432-1",
  bankAccountName: "นายเอก ใจดี",
  hasSlip: false,
  ...over,
});

describe("roleWord", () => {
  it("names the three positions as the form does", () => {
    expect(roleWord("super_admin").th).toBe("เจ้าของร้าน");
    expect(roleWord("admin").th).toBe("ผู้ดูแล");
    expect(roleWord("mechanic").th).toBe("ช่าง");
  });
});

describe("shownName", () => {
  it("uses the Thai nickname, else the account name", () => {
    expect(shownName(person())).toBe("บอย");
    expect(shownName(person({ nameTh: null, name: "Boy" }))).toBe("Boy");
  });
});

describe("seenLine", () => {
  it("says today and yesterday with the time", () => {
    expect(seenLine(at(2026, 10, 29, 8, 41), NOW).th).toBe("เข้าใช้ วันนี้ 08:41");
    expect(seenLine(at(2026, 10, 28, 17, 30), NOW).th).toBe("เข้าใช้ เมื่อวาน 17:30");
  });
  it("says only the day further back, with the Thai year when it is another year", () => {
    expect(seenLine(at(2026, 10, 27, 9, 0), NOW).th).toBe("เข้าใช้ 27 ต.ค.");
    expect(seenLine(at(2025, 12, 30, 9, 0), NOW).th).toBe("เข้าใช้ 30 ธ.ค. 2568");
  });
  it("says never when there is no sign-in", () => {
    expect(seenLine(null, NOW).th).toBe("ยังไม่เคยเข้าใช้");
  });
});

describe("personLine", () => {
  it("is the position and the last sign-in", () => {
    expect(personLine(person(), NOW)).toEqual({
      dot: null,
      text: { th: "ช่าง · เข้าใช้ เมื่อวาน 17:30", en: "Mechanic · Signed in yesterday 17:30" },
    });
  });
  it("puts a dot and ปิดอยู่ first for someone switched off", () => {
    const off = personLine(person({ status: "disabled", lastLoginAt: null }), NOW);
    expect(off.dot).toBe("off");
    expect(off.text.th).toBe("ปิดอยู่ · ยังไม่เคยเข้าใช้");
  });
});

describe("accessState", () => {
  it("says locked until when, red", () => {
    expect(accessState(person({ lockedUntil: at(2026, 10, 30, 9, 2) }), NOW)).toEqual({
      dot: "red",
      text: { th: "ล็อกอยู่ ถึงพรุ่งนี้ 09:02", en: "Locked until tomorrow 09:02" },
    });
  });
  it("is grey when switched off and green when they can sign in", () => {
    expect(accessState(person({ status: "disabled" }), NOW).dot).toBe("grey");
    expect(accessState(person(), NOW)).toEqual({
      dot: "green",
      text: { th: "เข้าใช้ได้", en: "Can sign in" },
    });
  });
  it("forgets a lock that has run out", () => {
    expect(accessState(person({ lockedUntil: at(2026, 10, 29, 9, 0) }), NOW).dot).toBe("green");
  });
});

describe("monthLabel", () => {
  it("is the short month and the Thai year", () => {
    expect(monthLabel("2026-10")).toEqual({ th: "ต.ค. 2569", en: "Oct 2026" });
    expect(monthLabel("2026-01").th).toBe("ม.ค. 2569");
  });
});

describe("salaryLine", () => {
  it("shows the month's whole pay and what is left to do", () => {
    expect(salaryLine(row()).th).toBe("฿13,725 · ที่ต้องจ่าย");
  });
  it("shows the day it was paid", () => {
    const paid = row({ amountSatang: 1_500_000, paidAt: at(2026, 10, 28, 18, 0) });
    expect(salaryLine(paid).th).toBe("฿15,000 · 28 ต.ค. · จ่ายแล้ว");
  });
});

describe("monthSummary", () => {
  const rows = [
    row(),
    row({
      userId: "u-boy",
      name: "บอย",
      amountSatang: 1_350_000,
      advanceSatang: 0,
      dueSatang: 1_350_000,
    }),
    row({
      userId: "u-nun",
      name: "น้องนุ่น",
      role: "admin",
      amountSatang: 1_500_000,
      advanceSatang: 0,
      dueSatang: 1_500_000,
      paidAt: at(2026, 10, 28),
    }),
  ];
  it("adds up as the card C drawing: advances already given count as paid", () => {
    const s = monthSummary(rows);
    expect(s.total).toBe("฿42,225");
    expect(s.count.th).toBe("จ่ายไป 1 จาก 3 คน");
    expect(s.split.th).toBe("จ่ายแล้ว ฿17,000 · ที่ต้องจ่าย ฿25,225");
  });
  it("is zero for an empty month", () => {
    const s = monthSummary([]);
    expect(s.total).toBe("฿0");
    expect(s.count.th).toBe("จ่ายไป 0 จาก 0 คน");
  });
});

describe("payHead", () => {
  it("is what is left to pay, whose month, and how it came to that", () => {
    expect(payHead(row(), "2026-10")).toEqual({
      amount: "฿11,725",
      who: { th: "เอก · เงินเดือน ต.ค. 2569", en: "เอก · Salary Oct 2026" },
      how: { th: "฿13,725 − เบิกแล้ว ฿2,000", en: "฿13,725 − advanced ฿2,000" },
    });
  });
  it("shows rate × days when nothing was advanced, half days as ½", () => {
    const boy = row({ name: "บอย", advanceSatang: 0, dueSatang: 1_350_000, workingHalves: 60 });
    expect(payHead(boy, "2026-10").how.th).toBe("฿450 × 30 วัน · ยังไม่เบิก");
    expect(payHead(row({ advanceSatang: 0, workingHalves: 59 }), "2026-10").how.th).toBe(
      "฿450 × 29½ วัน · ยังไม่เบิก",
    );
  });
});

describe("advancePick", () => {
  it("says how much was taken, and refuses a month already paid", () => {
    expect(advancePick(row())).toEqual({
      text: { th: "เบิกแล้ว ฿2,000", en: "Advanced ฿2,000" },
      open: true,
    });
    expect(advancePick(row({ advanceSatang: 0 })).text.th).toBe("ยังไม่เบิก");
    expect(advancePick(row({ paidAt: at(2026, 10, 28) }))).toEqual({
      text: { th: "จ่ายครบแล้ว · เบิกไม่ได้", en: "Paid in full · No advance" },
      open: false,
    });
  });
});

const month = (over: Partial<PaymentMonth> = {}): PaymentMonth => ({
  period: "2026-09",
  dayRateSatang: 45_000,
  offHalves: 0,
  workingHalves: 60,
  earnedSatang: 1_350_000,
  advanceSatang: 0,
  dueSatang: 1_350_000,
  owedSatang: 0,
  paidAt: at(2026, 9, 30, 17, 5),
  method: "transfer",
  hasSlip: true,
  paidBy: null,
  advances: [],
  ...over,
});

describe("yearSummary", () => {
  it("adds the year the way the month card does", () => {
    const s = yearSummary([
      month({ period: "2026-10", paidAt: null, method: null, hasSlip: false }),
      month(),
    ]);
    expect(s).toEqual({ total: "฿27,000", paid: "฿13,500", due: "฿13,500" });
  });
});

describe("daysWord", () => {
  it("counts days from halves, a half as ½", () => {
    expect(daysWord(60).th).toBe("30 วัน");
    expect(daysWord(59).th).toBe("29½ วัน");
    expect(daysWord(1).th).toBe("½ วัน");
    expect(daysWord(0)).toEqual({ th: "0 วัน", en: "0 days" });
  });
});

describe("historyLine and personPayLine", () => {
  it("says the day it was paid, with the month's whole pay", () => {
    expect(historyLine(month())).toEqual({
      sub: { th: "30 ก.ย. · จ่ายแล้ว", en: "30 Sep · Paid" },
      amount: "฿13,500",
    });
    expect(personPayLine(month()).th).toBe("จ่ายแล้ว ฿13,500");
  });
  it("says what is left to do for a month not paid yet", () => {
    const oct = month({ period: "2026-10", paidAt: null, method: null, hasSlip: false });
    expect(historyLine(oct).sub.th).toBe("ที่ต้องจ่าย");
    expect(personPayLine(oct).th).toBe("ที่ต้องจ่าย ฿13,500");
  });
});

describe("recordHead", () => {
  it("counts the payments of a month", () => {
    expect(recordHead(month()).th).toBe("จ่ายครบแล้ว");
    const aug = month({
      period: "2026-08",
      earnedSatang: 1_395_000,
      advanceSatang: 200_000,
      advances: [
        {
          id: "a1",
          givenOn: "2026-08-12",
          amountSatang: 200_000,
          method: "cash",
          hasSlip: false,
          note: null,
        },
      ],
    });
    expect(recordHead(aug).th).toBe("จ่ายครบแล้ว · 2 ครั้ง");
    expect(recordHead(month({ paidAt: null })).th).toBe("ที่ต้องจ่าย");
  });
});

describe("paymentLines", () => {
  it("lists the advances, then payday with the rest", () => {
    const aug = month({
      period: "2026-08",
      earnedSatang: 1_395_000,
      advanceSatang: 200_000,
      dueSatang: 1_195_000,
      paidAt: at(2026, 8, 31, 18, 20),
      method: "cash",
      hasSlip: false,
      advances: [
        {
          id: "a1",
          givenOn: "2026-08-12",
          amountSatang: 200_000,
          method: "cash",
          hasSlip: false,
          note: null,
        },
      ],
    });
    expect(paymentLines(aug)).toEqual([
      {
        key: "a1",
        when: { th: "12 ส.ค. 2569", en: "12 Aug 2026" },
        how: { th: "เงินเบิก · เงินสด", en: "Advance · Cash" },
        amount: "฿2,000",
        slip: null,
      },
      {
        key: "payday",
        when: { th: "31 ส.ค. 2569 · 18:20", en: "31 Aug 2026 · 18:20" },
        how: { th: "เงินเดือน · เงินสด", en: "Salary · Cash" },
        amount: "฿11,950",
        slip: null,
      },
    ]);
  });
  it("points a transfer payday at its slip", () => {
    expect(paymentLines(month())[0]!.slip).toEqual({ kind: "salary", period: "2026-09" });
  });
});

describe("slipState and slipNote", () => {
  const sep = month();
  it("keeps a wage slip three calendar months, and says until when", () => {
    expect(slipState(sep, NOW)).toBe("kept");
    expect(slipNote(sep).th).toBe(
      "ระบบเก็บรูปสลิปไว้ 3 เดือน ถึง 30 ธ.ค. 2569 · บันทึกลงเครื่องไว้ถ้าต้องเก็บนานกว่านั้น",
    );
  });
  it("says it is gone once the system deleted it", () => {
    expect(slipState(month({ hasSlip: false }), at(2027, 1, 2))).toBe("gone");
    expect(slipGoneNote(month()).th).toBe("ระบบเก็บรูปสลิปไว้ 3 เดือน ถึง 30 ธ.ค. 2569");
  });
  it("has no slip for cash or an unpaid month", () => {
    expect(slipState(month({ method: "cash", hasSlip: false }), NOW)).toBe("none");
    expect(slipState(month({ paidAt: null, hasSlip: false }), NOW)).toBe("none");
  });
});

describe("days off", () => {
  it("titles a day with its weekday", () => {
    expect(dayOffTitle("2026-10-28").th).toBe("28 ต.ค. · พุธ");
    expect(dayOffTitle("2026-10-25").th).toBe("25 ต.ค. · อาทิตย์");
  });
  it("says full or half a day, and late for the older late records", () => {
    expect(halvesWord(2).th).toBe("เต็มวัน");
    expect(halvesWord(1).th).toBe("ครึ่งวัน");
    expect(halvesWord(0).th).toBe("เข้าสาย");
  });
});

describe("history", () => {
  it("heads each day as today, yesterday or the date", () => {
    expect(dayHeading(at(2026, 10, 29, 9, 2), NOW).th).toBe("วันนี้ · 29 ต.ค.");
    expect(dayHeading(at(2026, 10, 28, 18, 10), NOW).th).toBe("เมื่อวาน · 28 ต.ค.");
    expect(dayHeading(at(2026, 10, 21, 18, 10), NOW).th).toBe("21 ต.ค.");
  });
  it("says what happened, as the drawing does", () => {
    expect(activityText("locked", null).th).toBe("เข้าใช้งานผิด 3 ครั้ง — ล็อก");
    expect(activityText("recovery_login", null).th).toBe("เข้าใช้งานผ่านทางเข้าฉุกเฉิน");
    expect(activityText("pin_changed", null).th).toBe("เปลี่ยนรหัส 6 หลักของตัวเอง");
    expect(activityText("password_changed", null).th).toBe("เปลี่ยนรหัสผ่านของตัวเอง");
  });
  it("reads the system's stored note into the drawn words", () => {
    expect(activityText("day_off", "2026-10-28 · เต็มวัน")).toEqual({
      th: "บันทึกวันหยุด — 28 ต.ค. เต็มวัน",
      en: "Recorded a day off — 28 Oct full day",
    });
    expect(activityText("day_off_edit", "2026-10-25 · ครึ่งวัน").th).toBe(
      "แก้ไขวันหยุด — 25 ต.ค. ครึ่งวัน",
    );
    expect(activityText("day_off_delete", "2026-10-21 · เอก").th).toBe(
      "ลบวันหยุด — 21 ต.ค. ของเอก",
    );
    expect(activityText("salary_paid", "เอก · 2026-10 · 11,725 บาท").th).toBe(
      "จ่ายเงินเดือน — เอก ต.ค. 2569 ฿11,725",
    );
    expect(activityText("advance_recorded", "บอย · 2026-10 · 1,000 บาท").th).toBe(
      "บันทึกเงินเบิก — บอย ต.ค. 2569 ฿1,000",
    );
    expect(activityText("advance_deleted", "บอย · 2026-10 · 1,000 บาท").th).toBe(
      "ลบเงินเบิก — บอย ต.ค. 2569 ฿1,000",
    );
    expect(activityText("pin_changed", "Reset the PIN for บอย").th).toBe(
      "ตั้งรหัส 6 หลักใหม่ให้บอย",
    );
    expect(activityText("pin_cleared", "Cleared the PIN for บอย").th).toBe("ล้างรหัส 6 หลักของบอย");
    expect(activityText("profile_edited", "Edited บอย’s profile").th).toBe("แก้ไขข้อมูลของบอย");
    expect(activityText("profile_edited", null).th).toBe("แก้ไขข้อมูลของตัวเอง");
  });
  it("shows the stored note as it is for a kind it does not know", () => {
    expect(activityText("something_new", "x").th).toBe("x");
    expect(activityText("something_new", null).th).toBe("something_new");
  });
});

describe("addProblems", () => {
  const ok = { nameTh: "บอย", phone: "0815555512", email: "", pin: "482913" };
  it("is clear when the form is filled", () => {
    expect(addProblems(ok)).toEqual({});
  });
  it("names only what is still empty", () => {
    expect(addProblems({ ...ok, nameTh: " ", phone: "" })).toEqual({
      nameTh: { th: "ยังไม่ได้ใส่ชื่อเล่น", en: "No nickname yet" },
      phone: { th: "ยังไม่ได้ใส่เบอร์โทร", en: "No phone number yet" },
    });
  });
  it("asks for a PIN only when there is no email, since that is then the only way in", () => {
    expect(addProblems({ ...ok, pin: "" }).pin?.th).toBe("ยังไม่ได้ใส่รหัส 6 หลัก");
    expect(addProblems({ ...ok, pin: "", email: "boy@denair.co" })).toEqual({});
  });
});

describe("random codes", () => {
  it("makes a 14-letter password without look-alike letters", () => {
    const p = randomPassword();
    expect(p).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{14}$/);
  });
  it("makes a six-digit PIN the server takes", () => {
    for (let i = 0; i < 50; i++) {
      const pin = randomPin();
      expect(pin).toMatch(/^\d{6}$/);
      expect(pin).not.toMatch(/^(\d)\1{5}$/);
    }
  });
});

describe("refusalWords", () => {
  it("says the drawn words for what the server refuses", () => {
    expect(refusalWords("email_taken", "x").th).toBe("อีเมลนี้มีบัญชีแล้ว");
    expect(refusalWords("password_too_short", "x").th).toBe("รหัสผ่านอย่างน้อย 8 ตัว");
    expect(refusalWords("pin_taken", "x").th).toBe("มีคนใช้รหัสนี้แล้ว เลือกใหม่");
  });
  it("shows the server's own sentence for a refusal it does not know", () => {
    expect(refusalWords("brand_new", "Something new.")).toEqual({
      th: "Something new.",
      en: "Something new.",
    });
  });
});

describe("months", () => {
  it("is this month, then the ones before it, across a new year", () => {
    expect(thisMonth(NOW)).toBe("2026-10");
    expect(recentMonths(at(2026, 2, 3), 4)).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
  });
});

describe("badgeLetters", () => {
  it("gives a one-word Thai nickname its first and last consonant, as the badges are drawn", () => {
    expect(badgeLetters("เอก")).toBe("อก");
    expect(badgeLetters("น้องนุ่น")).toBe("นน");
    expect(badgeLetters("ต้อม")).toBe("ตม");
  });
  it("keeps the account badge's letters for two words or a Latin name", () => {
    expect(badgeLetters("Lady Kirsah")).toBe("LK");
    expect(badgeLetters("สมชาย ใจดี")).toBe("สจ");
    expect(badgeLetters("Boy")).toBe("B");
  });
});

describe("teamOrder", () => {
  const p = (id: string, nameTh: string, role: string, status = "active") =>
    person({ id, name: nameTh, nameTh, role, status });
  it("puts owners first, then everyone in Thai order, and switched-off people last", () => {
    const order = teamOrder([
      p("tom", "ต้อม", "mechanic", "disabled"),
      p("nun", "น้องนุ่น", "admin"),
      p("eak", "เอก", "mechanic"),
      p("boss", "คุณเก๋", "super_admin"),
      p("boy", "บอย", "mechanic"),
    ]).map((x) => x.id);
    expect(order).toEqual(["boss", "nun", "boy", "eak", "tom"]);
  });
});

describe("the owner's locked account (พนักงาน 8, 4 Nov 2026)", () => {
  it("showsDelete > given the locked owner > then no ลบคนนี้, even for another owner", () => {
    expect(showsDelete({ id: "boss", locked: true }, "two")).toBe(false);
  });

  it("showsDelete > given your own page > then no ลบคนนี้ (nobody can delete themselves)", () => {
    expect(showsDelete({ id: "two", locked: false }, "two")).toBe(false);
  });

  it("showsDelete > given someone else > then ลบคนนี้", () => {
    expect(showsDelete({ id: "m1", locked: false }, "two")).toBe(true);
  });

  it("OWNER_LOCK_LINE > says what can't be done, as drawn", () => {
    expect(OWNER_LOCK_LINE.th).toBe("บัญชีเจ้าของร้าน · ลบ ปิดใช้ หรือเปลี่ยนตำแหน่งไม่ได้");
  });
});

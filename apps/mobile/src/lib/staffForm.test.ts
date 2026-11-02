import { describe, expect, it } from "vitest";
import { blankDraft, draftOf, newStaffBody, profileChanges, type PersonDraft } from "./staffForm";
import type { StaffProfile } from "./teamApi";

const localDay = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
const utcDay = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

const profile: StaffProfile = {
  id: "u-boy",
  name: "บอย",
  nameTh: "บอย",
  nameEn: "Boy",
  role: "mechanic",
  status: "active",
  lastLoginAt: null,
  lockedUntil: null,
  phone: "0815555512",
  hasPhoto: false,
  email: null,
  fullNameTh: "สมชาย ใจดี",
  fullNameEn: null,
  emergencyName: "สมใจ ใจดี",
  emergencyRelation: "แม่",
  emergencyPhone: "0815550091",
  startedOn: utcDay(2025, 3, 1),
  dayRateSatang: 45000,
  bankName: "กสิกร",
  bankAccountNo: "123-4-56789-0",
  bankAccountName: "นายสมชาย ใจดี",
  password: null,
  pin: "482913",
  hasPin: true,
  hasPassword: false,
};

describe("blankDraft", () => {
  it("starts as a mechanic who starts today", () => {
    const d = blankDraft(localDay(2026, 11, 2) + 5_000_000);
    expect(d.role).toBe("mechanic");
    expect(d.startedOn).toBe(localDay(2026, 11, 2));
    expect(d.nameTh).toBe("");
  });
});

describe("newStaffBody", () => {
  it("sends what was filled, trimmed, money in satang and the start day as the server keeps it", () => {
    const d: PersonDraft = {
      ...blankDraft(localDay(2026, 11, 2)),
      nameTh: " บอย ",
      phone: "081-555-5512",
      dayRate: "450",
      pin: "482913",
    };
    expect(newStaffBody(d)).toEqual({
      nameTh: "บอย",
      phone: "081-555-5512",
      role: "mechanic",
      dayRateSatang: 45000,
      startedOn: utcDay(2026, 11, 2),
      pin: "482913",
    });
  });
});

describe("draftOf and profileChanges", () => {
  it("reads a person back into the boxes", () => {
    const d = draftOf(profile);
    expect(d).toMatchObject({ nameEn: "Boy", dayRate: "450", email: "", pin: "" });
    expect(d.startedOn).toBe(localDay(2025, 3, 1));
  });

  it("sends nothing when nothing changed", () => {
    expect(profileChanges(profile, draftOf(profile))).toEqual({});
  });

  it("sends only what changed; an emptied box clears it", () => {
    const d = { ...draftOf(profile), fullNameTh: "", dayRate: "500", email: "boy@denair.co" };
    expect(profileChanges(profile, d)).toEqual({
      fullNameTh: null,
      dayRateSatang: 50000,
      email: "boy@denair.co",
    });
  });
});

---
type: guide
title: Days off — three screens, one rule about deleting
description: Where วันหยุด is recorded and read, which screen can do what, and why only the owner may delete
tags: [staff, hr, days-off, payroll, permissions]
timestamp: 2026-08-24
status: live
sources:
  [
    apps/api/src/staffRoutes.ts,
    apps/admin/src/app/DayOffTable.tsx,
    "apps/admin/src/app/settings/staff/[id]/StaffDaysOff.tsx",
  ]
---

# Days off — three screens, one rule about deleting

A day off is a plain Bangkok day (`staff_days_off.day` = `YYYY-MM-DD`, never a timestamp, so a date
cannot shift under a timezone) plus `halves`: **2 = เต็มวัน, 1 = ครึ่งวัน, 0 = เข้าสาย**. The shop
pays by the day, so 2 and 1 come off the month's working days; **เข้าสาย costs nothing** and is kept
as a record only.

## The three screens

| Screen | Whose | Can |
| --- | --- | --- |
| `/me` | your own | record, **edit** — never delete |
| Staff → วันหยุด | everyone's, one month | record for anyone, edit, **delete** |
| A person's profile (2026-08-24) | one person, one month | record, edit, **delete** |

All three draw the same `DayOffTable`, which differs only by `canDelete` and `showWho`. One editing
habit, learned once: teaching one gesture on one screen and a different one on another would make
whichever you met second feel broken.

## Why only the owner deletes

Editing leaves a record that the day was claimed. Deleting erases that it was ever claimed at all —
and that is the one that quietly **gives back a day's wage**. So it stays with the person who signs
the wages (owner, 5 Aug 2026). `/me` says so out loud: *ลบไม่ได้ ถ้าบันทึกผิดจนต้องลบจริง ๆ
ให้แจ้งเจ้าของ*. The profile screen is where "แจ้งเจ้าของ" now ends up, instead of a trip to the
team screen and a scan down a list of everybody.

## The profile card (owner, 2026-08-24)

Sits **above Payments**, because a month's days off are what produced the wage below it — reading
down the page is cause then effect. One month at a time, the month in the URL (`?month=2026-08`), so
every month is its own address and the back button behaves. Add / edit / delete, and no person
picker on the add form: you are already looking at exactly one person, so a picker could only be
used to get it wrong.

## Routes

| | |
| --- | --- |
| `GET /staff/me/days-off?month=` | your own |
| `GET /staff/days-off?month=` | everyone's — super admin |
| `GET /staff/:id/days-off?month=` | **one person's** — super admin (2026-08-24) |
| `POST /staff/:id/day-off` | record for someone — super admin |
| `PATCH /staff/days-off/:id` | edit — own row, or super admin |
| `DELETE /staff/days-off/:id` | **super admin only** |

`listDaysOffFor` is deliberately not "the team list, filtered in the page": `reason` is free text and
someone will write why they were at a hospital in it, so shipping the whole team's reasons to a page
that displays one of them hands the browser more than it needs.

## Parked: เงินเบิกล่วงหน้า (advance payment)

Designed with the owner on 2026-08-24, **not built**. Salary taken before payday, deducted from that
month's wage. Agreed rules: over-advancing is allowed, the month pays ฿0 and the excess shows **in
red as owed** with no automatic carry-over; staff see their own taken/remaining but cannot record
one. Needs a table, a payslip column so a paid month stays frozen, and two new Payments columns —
a payroll change, which is why it was split from this one.

Related: [products](products.md) · [roles-model](../auth/roles-model.md) ·
[staff-mechanic-section-plan](../auth/staff-mechanic-section-plan.md)

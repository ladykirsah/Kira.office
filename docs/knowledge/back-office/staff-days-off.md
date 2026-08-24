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

## The Record section (owner, 2026-08-24)

Built on the car-fitment page's **Add new**, which the owner picked as the working flow: pick what
you are recording, fill it in, Save. Three tabs — **วันหยุด · เบิกล่วงหน้า · จ่ายเงินเดือน** — at the
top of the profile, replacing the add form that used to sit *underneath* the วันหยุด table where you
had to scroll past the data to reach the input. The page now reads downwards as cause then effect:
**Record → วันหยุด → Payments**.

**Design B of three, and the reason matters.** Car brands and car models are the same kind of thing,
so equal tabs are honest there. A day off and a cash advance are not: one is attendance, the other
is money leaving the shop. Equal tabs would give them equal weight and equal muscle memory, and a
mis-tap would record ฿3,000 instead of a half day. So:

- a divider marked **เงิน** separates time from money;
- the panel and the Save button turn **amber** whenever money is involved — amber on this page means
  something is about to leave the shop;
- the Save button **always ends with the amount** (`บันทึกการเบิก ฿3,000`), so the last thing read
  before pressing is the number.

Amber, never `--primary`: red marks the one "you are here" control per view, and this is a warning
about what a control *does*.

## เงินเบิกล่วงหน้า — salary taken before payday

`staff_advances` (migration 0089), filed against the **month it comes off** rather than derived from
its date: an advance handed over on the 31st for next month's pay is a real thing, and deriving
would file it in the wrong month with no way to correct it.

| Rule | |
| --- | --- |
| Who | super admin records and deletes; staff read their own totals |
| Over-advancing | **allowed** — the month pays ฿0 and the excess shows **red as owed**; never carried into next month automatically |
| A paid month | refuses further advances (409) — the payslip froze the figure, and a later one would leave the two disagreeing |

## Cash or transfer — one rule, both forms

`payoutProblem()` in core owns it, so the advance form and the wage form cannot drift apart:
**cash needs nothing, a transfer needs its slip.**

This **changed how wages are marked paid**. A slip used to be demanded unconditionally, which is
wrong for a shop that mostly hands over cash: it pushed people into not recording the payment at
all, or attaching something meaningless to get past the form, and a rule people route around is not
a control. `staff_payslips.method` records which it was; rows written before today read as unknown,
because backfilling them "transfer" would be inventing a fact.

## Payments: one table, one sum

`staffPayments` no longer lists paid months only. An advance changes a month's figure the moment it
is handed over, so the month you are standing in is always listed — otherwise the one number you
want, *what do I owe on the 5th*, is the one the table will not show.

**เงินเดือน − เบิกไปแล้ว = คงเหลือ**, with the advance frozen onto the payslip at payment. A paid
month reports what the payslip froze; an unpaid one is computed live. Never the reverse — recomputing
a paid month is how a September raise, or a September advance, would rewrite what August handed over.

Related: [products](products.md) · [roles-model](../auth/roles-model.md) ·
[staff-mechanic-section-plan](../auth/staff-mechanic-section-plan.md)

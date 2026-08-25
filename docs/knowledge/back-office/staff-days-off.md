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
| A person's profile (2026-08-24) | one person, one month | edit, **delete** — recording happens in **Record** |

The profile's วันหยุด card has **no add form**: Record above it is the one input point on that page.
It carried its own for a few hours and that was simply two ways to do the same thing on one screen.
`/me` keeps its inline form, because there is no Record section there — and it wears the same coral
`.fill-panel` frame, so "the bit you fill in and Save" looks the same on both sides.

All three draw the same `DayOffTable`, which differs only by `canDelete` and `showWho`. One editing
habit, learned once: teaching one gesture on one screen and a different one on another would make
whichever you met second feel broken.

Row actions are **icon buttons** — a hairline, then bare `.icon-btn` pencil and trash, matching the
Services table (owner, 2026-08-24). A row action should look the same wherever it appears, and two
Thai words per row was a lot of ink for something done rarely. The glyphs live in the shared
`Icon.tsx` (`edit`, `trash`) rather than being re-inlined; the Services page still carries its own
copies, which predate that file.

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

## Month and year: two boxes, one per table

`<input type="month">` is gone. The owner's words were "**the time setting is un-clickable**", and
they were right: it is one field with two invisible halves, a calendar button a few pixels wide, and
it renders however the browser likes — on one machine "August 2026", in English and the western
year, beside a heading reading สิงหาคม 2569. `MonthYearPicker` is two plain selects instead.

**`lang` follows the words around it**, not a global setting: the วันหยุด card is Thai, so
สิงหาคม / 2569; the Payments table's own headings are English, so August / 2026. Everything crossing
a URL or the API stays `YYYY-MM` in the western calendar — **2569 must never reach the database**.

**Every table owns its own**, and they do not touch each other:

| | Its setting does |
| --- | --- |
| วันหยุด | picks the month it lists (in the URL, so back and bookmarks work) |
| Payments | **filters** to the month picked; a month with nothing against it says so by name |
| Record | none. The two entry tabs take their month from the date typed into them; จ่ายเงินเดือน has its own, because the month you are paying FOR is not the day you pay it |

One coupling had to be cut for that to be true: the wage table asks the API for the **real current
month**, not the one วันหยุด is browsing. Passing the browsed month made the วันหยุด picker quietly
add and drop rows from Payments.

Payments **jumped and highlighted** for a few hours first, on the argument that a wage history is
read by comparing one month against the one before, so hiding the rest takes away the reason you
opened it. The owner used it and asked for filtering (25 Aug). That settles it, and the reasoning is
worth keeping: the question people bring to this table is *"what about that month"*, not *"how do
the months compare"* — and it is the person using it daily who knows which.

## The Record section (owner, 2026-08-24)

Built on the car-fitment page's **Add new**, which the owner picked as the working flow: pick what
you are recording, fill it in, Save. Three tabs — **วันหยุด · เบิกล่วงหน้า · จ่ายเงินเดือน** — at the
top of the profile, and **the only place anything is entered on that page**: the วันหยุด card below
reads, corrects and deletes, and the Payments table below that is filled by the จ่ายเงินเดือน tab. The page now reads downwards as cause then effect:
**Record → วันหยุด → Payments**.

**Design B of three, and the reason matters.** Car brands and car models are the same kind of thing,
so equal tabs are honest there. A day off and a cash advance are not: one is attendance, the other
is money leaving the shop. Equal tabs would give them equal weight and equal muscle memory, and a
mis-tap would record ฿3,000 instead of a half day. So:

- a divider in the tab row, and a panel behind the two money forms (`--primary-faint`, the house
  coral wash for a grouped panel);
- the Save button **always ends with the amount** — `บันทึกการเบิก ฿3,000`, never a bare "Save".

**The second one is the safeguard, and it is the one that survived.** Four colour treatments were
tried and removed by the owner across 2026-08-24 — a **เงิน** label on the divider, **amber tabs**, a
**⚠ line** above the form, and finally the **amber panel and amber button**. Each restated in colour
what the button already says in words. Everything is the house coral now.

Worth remembering before reaching for a colour again: the number in the label is what stops a
mis-tap, not the hue around it.

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

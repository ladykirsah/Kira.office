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
| `GET /staff/advances/:id/slip` | one advance's slip — owner, or the person it paid (2026-08-25) |

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
| วันหยุด | picks the month it lists — the month stays in the URL, so a month is still a bookmarkable address |
| Payments | **filters** to the month picked; a month with nothing against it says so by name |
| Record | none. The two entry tabs take their month from the date typed into them; จ่ายเงินเดือน has its own, because the month you are paying FOR is not the day you pay it |

One coupling had to be cut for that to be true: the wage table asks the API for the **real current
month**, not the one วันหยุด is browsing. Passing the browsed month made the วันหยุด picker quietly
add and drop rows from Payments.

**Both pickers behave the same way in the hand** (owner, 25 Aug: *"make sure time setting here
function the same"*). They are built differently — Payments filters a list it already holds, วันหยุด
fetches the month from the server — and that difference is fine, because only one month of days off
is ever loaded. What was *not* fine was that the difference showed:

| | Before | Now |
| --- | --- | --- |
| The page when you pick a month | **jumped to the top** — measured: scroll 975 → 0, leaving the card you were reading 1,089px below the fold | stays exactly where it was |
| Back, after looking at three months | four presses to leave the page | **one** — Back returns to the staff list |

`router.replace(url, { scroll: false })` is the whole fix. `scroll: false` because a control has to
stay under the finger that just used it; `replace` because a filter is not a place you travel to,
which is the same rule the storefront's filters follow. The month keeps its place in the URL, so
nothing was given up to get it.

Revisiting a month you already looked at re-reads the database rather than replaying a cached
payload — verified, and it holds because the page is `force-dynamic` and the fetch is `no-store`.

Payments **jumped and highlighted** for a few hours first, on the argument that a wage history is
read by comparing one month against the one before, so hiding the rest takes away the reason you
opened it. The owner used it and asked for filtering (25 Aug). That settles it, and the reasoning is
worth keeping: the question people bring to this table is *"what about that month"*, not *"how do
the months compare"* — and it is the person using it daily who knows which.

## One page shape, both sides (owner, 2026-08-25)

*"Apply 1st page (super admin HRM) to the 2nd one (self-manage), with only one change."* `/me` now
has the staff profile's layout — two cards abreast, then วันหยุด, then the wage ledger, then Signing
in — so what the owner learns on one transfers to the other.

| | HRM (`/settings/staff/:id`) | Own page (`/me`) |
| --- | --- | --- |
| Top | Details + Pay | Your details + Pay |
| Entry | **Record**, three tabs | **no Record** — the day-off form sits at the BOTTOM of the วันหยุด card |
| วันหยุด | month picker, edit, **delete** | month picker, edit, **no delete** |
| Payments | ledger + "Pay into" account | ledger, **no** "Pay into" |
| Bank | full number, in Pay | **full number**, in Pay |

**The form moved below the table.** It used to sit above it, which asked you to record a day before
you could see which days you had already recorded. Below, you read the month and then add to it.

**No Record section here, and that is the one intended difference.** On the owner's side Record is
the single input point and the วันหยุด card only reads; a person's own page has one thing to enter,
so a three-tab chooser for it would be furniture.

**The bank account shows in full on a person's own page** (owner, asked directly). It was masked
(····7890). Hiding someone's own account number from them protects nobody, and showing it lets them
check the shop is paying into the right one. The "Pay into" block under the Total stays HRM-only —
that one belongs to whoever is *making* the transfer.

**Staff see every advance row, notes and slips** (owner, asked directly). They were there when the
money was handed over and they gave the reason; seeing it back is how they check it was recorded
right. `staffPayments` already allowed self and nobody else, so no permission changed — the rows
simply carry more than a monthly sum now.

The two month pickers on `/me` are independent, exactly as on the HRM page. `/me`'s วันหยุด picker
is local state and refetches, rather than the URL: nothing on that page is server-rendered per
month, so a refetch does the whole job without a navigation.

## Signing in: view, and change (owner, 2026-08-25)

*"Function here is messy · 2 function requested here — view, change."* `/me` had a hand-rolled
version of this card: each secret showed its dots, a Show button, **and a permanently open input
box** with a greyed-out Change beside it. A form standing open when you are not filling anything in
reads as a job left half done, and the grey button never said what it wanted.

It now uses `SecretRow` — the same component the owner's staff-profile page already used, and the
last card on `/me` that was still bespoke. Two actions, nothing else: the eye reveals, the word
opens the box.

Two backward-compatible additions made it serve both sides:

| | Somebody else's (HRM) | Your own (`/me`) |
| --- | --- | --- |
| The button says | **reset** | **change** — nobody resets their own |
| Opening it | proposes a generated value, with ↻ for another | opens **empty**; no ↻ — you are choosing it, not being handed it |

**A new secret is typed twice** (owner, 2026-08-25). Two boxes on one line — the new value, then
`พิมพ์อีกครั้ง` — and Save refuses a pair that disagrees before anything reaches the server.

Why here and nowhere else on the page: every other mistake can be read back off the screen and
corrected. A password can only be read back by someone who is *still signed in*, and a typo'd
password is precisely the thing that stops you being signed in. It is the one lockout the app can
inflict on itself.

`confirmationProblem` (`lib/secretConfirm.ts`) carries two decisions worth keeping:

- **An empty second box gets a different message from a mismatch.** "They don't match" is both wrong
  and faintly accusing when the person has simply not reached the second box yet.
- **The pair is compared the way it will be STORED, not the way it was typed.** The password saves
  trimmed, so a stray trailing space is not a mismatch — rejecting two entries that would save
  identically is a wrong answer whose cause is invisible on screen.

The owner's side gets **no** second box: a generated value is on screen to be read, so there is
nothing to mistype and the extra field would be pure friction. That is what the `confirm` prop
separates.

**Validation moved into Save**, which is what keeps "change is always available always" true (the
owner's words, same day). Nothing greys out; a password under 8 characters or a PIN that is not six
digits is told so, the box stays open with what you typed still in it, and nothing reaches the
server. Verified: `12` in the PIN box warns and sends no request.

The PIN was already recoverable — `ownProfile` decrypts it exactly like the password — so the
missing reveal was an oversight in the page, never a limitation.

## Payments is a ledger, not a summary (owner, 2026-08-25)

The owner's words: *"I want this table to be like real calculation that include both of salary and
advance paid."* It was one row per month with the advance as a single column. Now one month is
opened out into the payments that make it up:

| Date | Day rate | Working days | Amount | Status | Paid by |
| --- | --- | --- | --- | --- | --- |
| 5 Sept 2026 · Salary | ฿500 | 30 (1 off) | ฿15,000 | Unpaid | — |
| 20 Aug 2026 · เบิกล่วงหน้า | ซ่อมรถ (spans both) | | −฿1,500 | Paid | โอน + slip |
| 8 Aug 2026 · เบิกล่วงหน้า | ค่าเทอมลูก (spans both) | | −฿2,000 | Paid | เงินสด |
| **Total** | | | **฿11,500** | | |

**The salary date is always the 5th of the following month** — `salaryDueDate` in core. A rule, not
a record: the row reads 5 September whether the money moved on the 5th, the 8th, or not yet. The
owner was asked directly and chose the rule over the real date, because payday is a promise the shop
makes and a date that slides when you are late reads as though the promise slid too. What actually
happened is on the row's status and its slip.

**The Total is what is still to hand over**, also the owner's call when asked. The alternative was a
Total of the whole month's wage with the salary row showing the net — both add up, but this one
keeps the salary row checkable: ฿500 × 30 is right there and equals the ฿15,000 beside it, so the
month can be verified by eye without knowing what an advance is.

**An advance's note takes the two columns the salary row uses for its working.** An advance has no
day rate and no working days, and leaving those cells blank read as missing data rather than as not
applicable.

**The bank account sits under the Total, read-only, with a copy button** — that is the moment you
need it, having just read what to pay. Editing stays in the **Pay** card (owner's choice): two
places to change one field is exactly what was removed from the วันหยุด card. It is passed only by
the owner's HRM view; `/me` is the person's own page and has no Total to sit under.

**Advance slips could be uploaded but never looked at.** `POST /staff/:id/advance-slip` has worked
since migration 0089; nothing ever served the image back. Asking for slips on advance rows exposed
it, so `GET /staff/advances/:id/slip` now exists — same gate as a wage slip (the owner, or the
person the money went to), same `private` caching, because it is the same kind of document carrying
the same bank details. Verified end to end: upload → 200, fetch → 200 with the bytes.

**`staffPayments` returns advances one by one**, not a monthly sum, and never the slip key — only
whether one exists. A sum cannot say which day money went, whether it was cash, or whether there is
a slip to show for it.

**A paid month refuses BOTH ways** (fixed 2026-08-25). `recordAdvance` had always returned 409 for
an already-paid month; `deleteAdvance` had not, and the asymmetry was the bug. The payslip freezes
`advance_satang` at the moment of payment, so removing a row afterwards left the frozen figure and
the surviving rows disagreeing with nothing to say which was true — and the ledger showed it plainly,
listing the rows while taking its Total from the frozen figure, so the column stopped adding up.

The failing test measured exactly that before the fix: after deleting, the visible rows summed to ฿0
while the payslip still reported ฿2,000. Both calls now make the same check and return the same 409.
A paid month is a record of what was handed over, not a running total; correcting one means
correcting the payment.

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

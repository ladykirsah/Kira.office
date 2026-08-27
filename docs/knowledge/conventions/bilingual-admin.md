# The back office speaks Thai and English

The owner asked for a language switch that works "the same as light and dark mode" (2026-08-25).
It is a button in the top bar, beside the moon, and it remembers what you chose.

## It could not be built the same way, and the owner was told before it was

Dark mode is **colour**: the browser repaints text that is already on the page, so `localStorage`
plus a CSS attribute is enough and nothing is fetched. Language is **the text itself**, and most of
this app writes its text on the server before the browser sees it.

So the choice is a **cookie** (`kira-lang`) the server reads on the next request, and switching
costs one render rather than one repaint. Measured warm: **466ms → 266ms → 158ms**. The first switch
after a code change looks much slower — that is the dev server recompiling, not the toggle.

## Both languages are written where the words are used

```tsx
<h2>{t({ th: "รายการจ่ายเงิน", en: "Payments" })}</h2>
```

Not keys into a dictionary file. With no translator in the loop, keys buy nothing and cost accuracy:
a phrase and its translation on one line cannot drift apart, a screen can be reviewed by reading
that screen's own file, and nothing rots into an orphan key nobody opens. The trade — no
machine-extractable string table — is worth it for one shop's back office.

| | |
| --- | --- |
| `lib/lang.ts` | `Phrase`, `readLang`, `say` — the pure decision, testable without a request |
| `lib/serverLang.ts` | `serverT()` for server components (`next/headers` cannot be imported into a client one) |
| `app/LangProvider.tsx` | `useT()` for client components |
| `app/LanguageToggle.tsx` | the button; writes the cookie, then `router.refresh()` |

**Thai is the default.** A Thai mechanic signing in for the first time should not have to find a
button before the screen speaks to them. An unrecognised cookie value falls back rather than being
passed on — it is typed by whoever holds the browser.

## What does NOT translate, and why each is deliberate

The rule: **what a person reads translates; what a machine matches does not.**

| | |
| --- | --- |
| The printed shipping label | read by a Thai courier and a Thai recipient — which language the operator is reading has nothing to do with it |
| The POS bill and quotation | they have their own switch, `billLang`, chosen per document — that language belongs to the customer holding the bill, not to whoever is at the till |
| `DELETE` in the delete confirmation | the code compares that exact word; only the instruction around it translates |
| Readiness filter values | they identify a row's state; if they moved with the language a set filter would stop matching |
| AirPlus · Shopee · Kira.office · Den Air Service | names, not words. Only the verb in front changes: วางขายบน AirPlus |
| The language button's own labels | a button offering Thai says so in Thai, as the English side says "Switch to English" in English |

## The finder was lying, and here is how it was caught

It called the coupons screen clean while a third of it was English (2026-08-26). Reading that screen
by hand turned up **five** places text hides that it never looked at:

| Where | Example |
|---|---|
| Wrapped onto its own line by prettier | `<button>`⏎`  Cancel`⏎`</button>` |
| Chosen inside braces | `{busy ? "Saving…" : "Save note"}` |
| A message that pops up | `toast("Draft saved — reopen it any time.")` |
| Built with a backtick | `` `Added ${p.name}` `` |
| Split in half by a count | `Items ({lines.length})` |

So it stopped asking "is this somewhere I know about" and started asking "does this read like
something a person reads" — **every** string literal is judged now, wherever it sits. A sixth hole
came from the other end: a phrase does not have to start with a capital (`"paused — not for sale"`,
`"hold to see profit"`), and the old rule required one.

That turned up **about 65 pieces of English on screens already declared finished** — most of them
pop-up messages, which is exactly where an eye-sweep never looks because you have to make something
go wrong to see them.

**A finder that cries wolf gets ignored, which is the same as not having one.** So each exclusion is
a test, not a note: keyboard key names (`e.key === "Escape"`), font names, import paths, object keys,
the English half of a `t({ })` pair, the code between two JSX branches, and `>` when it means greater
than rather than a tag. Two limits are deliberate and written into the tests:

- **Two lowercase words are left alone**, because that is what class names look like (`pill soft`,
  `btn-danger btn-sm`). A two-word fragment like `" · editing now"` gets past and has to be caught
  by reading.
- Text broken into more than two pieces by expressions is only partly seen.

## Refusals the server makes, said again on the screen

The API answers a duplicate coupon code and a delete-of-a-redeemed-coupon with a 409 — **in English**,
because a request carries no opinion about who is reading it. Both answers are already knowable from
what is on the screen (the list of codes, the redemption count), so they are decided in
`lib/couponRefusal.ts` and spoken in the reader's language. The 409 stays as the backstop for the gap
between the check and the request — another till can claim a code in between.

Pure functions rather than lines inside a button, so both refusals can be proved without a redeemed
coupon to click on.

## The POS already had a language, and it means something else

`billLang` selects Thai or English for the **printed** bill and quotation. Wiring the app toggle
into it would print English bills for Thai customers the moment an operator switched their own
screen. The guard in `untranslated.test.ts` excuses the bill's words **by name** rather than
excusing the file, so the POS screen around them is still watched.

Looking at it turned up four bugs that predate any of this: the **thermal receipt** had `CASH BILL`,
`TOTAL`, `Subtotal`, `Discount` and `Note:` typed in by hand, so a Thai customer's receipt printed
English while the A4 size — using the same dictionary correctly — did not.

## The sign-in screen carries its own language button

It is the one screen OUTSIDE the app frame, so the flag in the top bar does not exist there. Until
2026-08-26 that meant the first thing anybody ever saw was the only thing still entirely in English,
and the language could only be changed *after* signing in — which is the wrong way round. The same
`<LanguageToggle />` now sits at the top of both `/login` and `/recover`; nothing new was needed, the
cookie and the refresh work identically outside the frame.

Their `<title>` had to move from `export const metadata` to `generateMetadata()`, because a title
that depends on a cookie cannot be a constant. Both pages are already `force-dynamic`, so this costs
nothing.

## The staff section, and text that is not on the screen it appears on

Two thirds of that area was already Thai — written Thai-only, so it showed Thai to an English reader
as surely as an English screen shows English to a Thai one. Translation goes both ways.

Three things there could not be fixed on the screen at all:

- **`packages/core/dayOff.ts`** builds the sentence "หยุดไปแล้ว 2 วันครึ่ง". It now takes a language
  and says "2½ days taken" too — a half written as `½` rather than `2.5`, because a decimal point
  next to money invites being read as money. `leaveModeLabel` deliberately stays **Thai only**: the
  API writes it into the activity log, and a record already written cannot depend on who reads it a
  month later. Screens use the new `leaveModePhrase`.
- **`lib/dayOff.ts`'s `monthLabel`** returned "สิงหาคม 2569". The YEAR had to move with the language
  too — 2569 is the Buddhist era, which is what a Thai reader expects and the wrong number entirely
  for anyone else.
- **Three copies of the role names** — the top-bar chip, the profile editor, the /me page — two of
  them English-only. Now one `lib/roleLabel.ts`. `super_admin` reads as **เจ้าของร้าน**, because in
  this shop there is exactly one and that is what everybody calls them.

Dates were the quiet half of this: `toLocaleDateString("en-GB")` was hard-coded in six places, so a
Thai screen printed English months. They follow the reader now.

## `useT()` is memoised, and that is load-bearing

It used to return a fresh closure on every render. Harmless while rendering, and impossible to name
in a `useEffect` or `useCallback` dependency list: including it re-runs the effect every render — a
refetch loop — and leaving it out is the lint warning that says so. Two callbacks on the customers
screen hit exactly that. `useT` now wraps its function in `useCallback` keyed on the language, so a
screen can simply list `t` and be right. Verified in the browser: one request, not a loop.

While there: **three separate debounce handles were named `t`**, shadowing the translator inside
their own effect. Renamed to `timer`. A one-letter name for the most-used function in the app is
worth watching for.

## Some Thai must never be translated

The customers screen matches the owner's transcription Google Sheet by its **column headers** —
ทะเบียน, จังหวัด, ชื่อลูกค้า and five more. Those are compared against a real file, not read off a
screen; translating one would break the import with no error to see. Excused by name in the guard,
the same way the POS bill is.

## Words the owner chose

Asked directly rather than guessed, because the shop already had a name for most of them.

| | |
| --- | --- |
| Menu | **ทำบิล** (Point of Sale) · **รายการสต็อก** (Stock movements) · **ภาพรวม AirPlus** (Insight) · **สินค้านายหน้า** (Affiliate Promote) |
| Dashboard | **ภาพรวม** · **ต้องจัดการ** (Needs your action) · **รอดำเนินการ** (Pending) |
| Wages | **รายการจ่ายเงิน** (Payments) · **คงเหลือ** (Total) · **วิธีจ่าย** (Paid by) |
| Products | **วางขาย** (Live) · **หยุดขาย** (Paused) · **เหลือน้อย / หมด** (Low / Out) · **ไม่มีรูป → พร้อมขาย** |
| POS | **ทำบิล** · **ฉบับร่าง / ทำบิลต่อ** (draft / reopen) · **ราคาช่าง** (wholesale) · **ไปหน้าชำระเงิน** |
| Coupons | **โค้ด** (code) · **จำนวนส่วนลด** (quota) · **สิทธิ์ต่อคน** (per customer) · **ส่วนลดสูงสุด** (max cap) |
| Sign-in | **เข้าใช้งาน** (sign in) · **รหัส 6 หลัก** (the PIN — the letters "PIN" dropped entirely) · **ทางเข้าฉุกเฉิน** (owner rescue) |
| Staff | **เพิ่มรายการต่างๆ** (Record) · **ประวัติการทำงาน** (Activity) · **คนในร้าน** (People) · **เจ้าของร้าน / ผู้ดูแล / ช่าง** (the three roles) |
| Customers | **เข้ามาที่ร้าน** (Visits) · **ประวัติการใช้บริการ** (Purchase & repair history) |

Order statuses were NOT re-invented: เตรียมจัดส่ง, กำลังจัดส่ง, คืนเงิน come from
[commerce/order-lifecycle](../commerce/order-lifecycle.md), and the 13 operational statuses were
already written in the owner's Thai inside `packages/core/src/operationalStatus.ts` — with a note
saying they were there so the switch would be wiring rather than a rewrite. It was.

## The sweep is checked by a program, not by eye

`lib/untranslated.ts` reads source and reports English text in JSX or in
label/placeholder/title/aria-label/alt, plus bare Thai strings (which show Thai in English mode).
It reads source rather than running the app, so it also finds text on screens nobody thinks to
open — error branches, empty states, the third tab of a form.

Screen-by-screen review by eye kept missing things; the first run of this found **896 strings across
81 files**, and **24** of them were in screens already declared finished.

`lib/untranslated.test.ts` fails if any *cleared* folder gains untranslated text. **Add a folder to
`CLEARED` the moment its sweep is done** — that is what stops the next screen from undoing this one.
Deliberate single-language files go in `DELIBERATE` with the reason, never silently skipped.

> The test was green for the wrong reason at first: vitest runs from the repo root, so a
> cwd-relative path found no files and every folder passed while checking nothing. It now resolves
> from its own location and asserts it read at least 30 files. Two bugs in the detector itself came
> out the same way — **฿ (U+0E3F) sits in the Thai Unicode block** so "Item cost ฿" read as
> untranslated Thai, and `() => Promise<void>` read as the word "Promise" on a screen.

## Done, and not done

**Done:** the frame (menu, top bar, both toggles, Modal), dashboard, orders list, order detail,
products list, product forms, the POS, coupons, the sign-in and rescue screens, the whole staff
section (people, salary, days off, activity, each person's page, and /me), and **customers** (both
the Den Air car directory and the AirPlus accounts) — plus the shared pieces
those screens render (`ConfirmButton`, `DateTimeField`, `NoAccess`), each of which had been English
on every screen using it.

**Not done:** shop settings, affiliate items, `AttributeManager`, banners, campaigns, car-fitment,
barcodes, scan, sales and insights — roughly **320 strings**. The storefront was never in scope: the owner chose back
office only.

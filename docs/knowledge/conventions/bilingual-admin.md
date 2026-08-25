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
| `DELETE` in the delete confirmation | the code compares that exact word; only the instruction around it translates |
| Readiness filter values | they identify a row's state; if they moved with the language a set filter would stop matching |
| AirPlus · Shopee · Kira.office · Den Air Service | names, not words. Only the verb in front changes: วางขายบน AirPlus |
| The language button's own labels | a button offering Thai says so in Thai, as the English side says "Switch to English" in English |

## Words the owner chose

Asked directly rather than guessed, because the shop already had a name for most of them.

| | |
| --- | --- |
| Menu | **ทำบิล** (Point of Sale) · **รายการสต็อก** (Stock movements) · **ภาพรวม AirPlus** (Insight) · **สินค้านายหน้า** (Affiliate Promote) |
| Dashboard | **ภาพรวม** · **ต้องจัดการ** (Needs your action) · **รอดำเนินการ** (Pending) |
| Wages | **รายการจ่ายเงิน** (Payments) · **คงเหลือ** (Total) · **วิธีจ่าย** (Paid by) |
| Products | **วางขาย** (Live) · **หยุดขาย** (Paused) · **เหลือน้อย / หมด** (Low / Out) · **ไม่มีรูป → พร้อมขาย** |

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
products list and product forms.

**Not done:** POS (79), coupons (53), customers (47), shop settings (44), the staff forms (~76),
and the rest — roughly **790 strings**. The storefront was never in scope: the owner chose back
office only.

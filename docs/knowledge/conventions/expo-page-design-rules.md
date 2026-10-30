---
type: convention
title: Drawing and building an Expo page — the Orders lessons
description: The checklist every new Expo page follows, from the drawing on the design canvas to the built screen. Each rule is a correction the owner had to make while designing Orders (Oct 2026); following it means they never have to make it again.
tags: [conventions, expo, design-canvas, owner, mobile, layout]
timestamp: 2026-10-30
status: convention
sources: [Orders design rounds v106–v121 (29–30 Oct 2026), apps/mobile/src/lib/frame.ts, apps/mobile/src/lib/orderPage.ts, apps/mobile/src/ui/orders/pin.ts]
---

# Drawing and building an Expo page — the Orders lessons

Orders took many rounds: each item below is something the owner had to point out. Run the
whole list before showing a drawing, and again before calling a build ready for the preview.

## 1 · Organise the canvas so the owner can follow it

The owner judges by the canvas. On Orders they said *"I can find nothing"* until it was rebuilt.

- **One flow per board.** Different flows are never mixed. Customer transfer, cash on delivery and
  claims were three flows on Orders.
- **One stage = one row.** The row starts with the stage's **whole page**. After it come
  everything its buttons and › rows open: sheets, error states and sub-pages, left to right.
- **A button that moves to another stage ends the row.** Examples: ยืนยัน, บันทึก, อนุมัติ. Close
  the row with a small **ท้ายแถว** card that says which button goes to which row next. A button
  that opens a page (ปฏิเสธ, ›) stays in the row.
- **Board header:** a big number and the flow's name, plus one line on how to read the rows.
- **Label every phone with what you tap** ("แตะ ยอดรวมทั้งสิ้น ›", "กด ปฏิเสธ → ใส่เหตุผล").
  Labels wrap at 390px, or they push phones off the board. Tag each phone:
  - **ในแอปแล้ว** — already built in the app
  - **ระบบยังไม่มี** — the server cannot do it yet
  - no tag — a new design
- **A board is at most 8000px tall.** The canvas silently cuts anything taller. Split a long
  flow into "ขั้น 1–2" and "ขั้น 3–4" boards in the same column.
- **Re-read the live `canvas.json` before every publish.** The canvas rewrites it. Merge onto
  that copy, never onto an old local one.
- **Clean up after a build.** Delete old versions and options that weren't picked, and say which
  ones went.

## 2 · Lay out the page the Shopee way

The owner showed the Shopee seller app as the model.

- **The main action is pinned at the bottom** on every stage: red, with a grey second choice
  under it. It never sits inside a card. The card at the top keeps only what you need in order
  to decide.
- **The main page stays short.** Details sit behind › on pages of their own. On Orders:
  - the parcel and its timeline
  - the money (shipping fee, profit)
  - the customer
  - each file
- **Files stay together** in one ไฟล์ card. Each file row opens its own page.
- **PDF / PNG save the file.** They do not open or preview it.
- **Draw every stage as the whole page,** not just the top block.

## 3 · The tab bar belongs to main pages only

- **Main page** (reached from the tab bar or ☰): it shows the floating tab bar.
- **Sub-page** (any page with a ‹ back link): no tab bar. Its pinned action sits just above the
  home bar.
  - In the drawing that is `bottom: 34`.
  - In the app it is `lib/frame.ts`, which is tested.
- **Sheets and pop-ups** cover the bar.
- **Apple vs Shopee:** Apple's guide keeps the bar on most screens. The owner chose Shopee's way.

## 4 · Sizes come from the design guide, never by eye

- **Gaps** use only the guide's 7 steps:
  - 4 between an icon and its word
  - 8 inside a group
  - 12 from a heading to its card
  - 16 at the screen edge and inside a card
  - 20 inside a big card
  - 28 between groups
  - 40 between big sections
- **Row heights:** 52 for one line, 68 with a grey second line, 84 for three lines.
  - Use `box-sizing: border-box` on drawn rows. Without it the padding is *added*, and a 68 row
    became 72.
- **When the owner says "the gap is wrong", measure what their screenshot points at.** On Orders,
  "the bigger gap" meant row height, not the space between groups. It took two rounds to get it
  right.
- **Red is for the one main action only.** A phone number is grey, not a red link.

## 5 · Say it before you build it

- **When something the drawing needs doesn't exist, say so before building.** On Orders that was
  Cancel order: the API can't return stock, release a coupon or refund. Tag it ระบบยังไม่มี and
  build everything else.
- **Never build a smaller stand-in** and explain it afterwards.

## 6 · Check the build like the owner would

- **Restart the preview after every change.** "Kira new version" runs Metro in CI mode, so it does
  not reload on its own.
- **The practice sign-in drops when the page reloads.** Open
  `/sign-in?practice=1&to=<page>` again.
  - In the iPhone simulator, taps land late after a scroll, because Safari's toolbar moves the
    page. Use the browser pane for exact clicks, and the simulator for how the phone looks.
- **Open every › page and every sheet the drawing shows,** and try the pinned buttons, before
  saying it matches.

## 7 · Get the push OK in chat, early

- **The push guard reads only the owner's latest chat message.** A `/goal` does not count.
- **Put the whole plan in chat at the start of a build,** in one line, for example
  `Plan: build > preview > commit > PR > merge if CI passes`. Get the "go" before the long work,
  so the push isn't blocked at the very end.

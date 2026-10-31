---
type: convention
title: Designing for the owner — every rule they have set
description: The one rulebook for drawing and building any back-office (CrewEngine) page. Every line is a correction or a choice the owner made, from the admin days (Jul–Aug 2026) through the Expo redesign and Orders (Oct 2026). Read it before the first drawing of a page and again before calling a build ready.
tags: [conventions, expo, design-canvas, owner, mobile, layout, design-system]
timestamp: 2026-10-30
status: convention
sources: [owner chat + canvas messages 25–30 Oct 2026, Orders design rounds v106–v124, memory feedback notes (apple-ui-lessons, red-reserved-for-active-only, dont-add-colour-to-repeat-words, owner-selected-elements-scope, owner-picked-design-keeps-all-functions, search-match-equals-result, product-photo-vs-category-picture, tab-bar-main-pages-only, artifact-cleanup-after-build), apps/mobile/src/lib/frame.ts, apps/mobile/src/lib/orderPage.ts]
---

# Designing for the owner — every rule they have set

The owner judges by what they see on the canvas and on the preview. Each rule below cost at
least one design round when it was missed. **Run the whole list before showing a drawing, and
again before saying a build matches.** The owner's words are quoted where they set the rule.

## 1 · The work loop

- **design on artifact → apply to preview → their approval → commit → (after merge) learn &
  file.** Do the step they named, and only that step. "artifact = where we draft. preview = build
  for approval."
- **Close the whole loop before the next page:** merged → every deploy job on `main` succeeded →
  learn & file done → then tell the owner "go to the next page: …". *"done all then tell me to go
  to next page, i do not want to skip any steps"* (30 Oct).
- **One page at a time, in menu order** (`packages/shared` nav.ts). Each page: learn what the old
  back office does → look at Mobbin → draw → their OK → build.
- **Learn the old functions before drawing.** Orders v1 *"look good, but not functionable"*.
  Every old function, status and filter must have a home in the new drawing.
- **Use best practice and the skills.** Check Mobbin and run `ux-heuristics` and the `hig-*`
  skills before showing a drawing. *"suggest me with the best practice, also do not forget to use
  skills."*
- **Draw every stage and everything a tap opens.** The owner had to ask for missing ones
  (*"show me ปฏิเสธการเคลม stage"*, *"show me what happen after clicking on the ใบแปะหน้า"*,
  สินค้า 31 Oct: *"you miss a lot of stage. click > to where?"*). Before publishing, list every
  tappable thing on every phone — each ＋ row, scan icon, copy button, photo tile, search box,
  the save that can fail — and check each one has a phone after it, or an end-card line naming
  the page it goes to. A ＋ เพิ่ม…ใหม่ row needs its add form drawn.
- **Reuse what is built before drawing a new way.** The car picker is brand → model (the built
  ทำบิล CarSheet), not a segmented control of brands. A segmented control holds 4 options or
  fewer (design guide); "อื่น ๆ" as a fifth is a sign it is the wrong control. Sheets, toasts and
  the pinned-button band copy the built components in `apps/mobile/src/ui`.
- **The same kind of sheet has the same parts.** Every pick list gets a search bar, the ＋ row and
  the same height. *"why ระบบรถ is the only one without search bar?"*
- **Fix the old parts of a board you touch.** Older phones on the same board broke later rules
  (grey captions, "แสดง 142 รายการ" on a button, a แก้ไข that pointed at the wrong page). Re-check
  the whole board against this rulebook, not only the new phones.
- **Draw the super-admin (เจ้าของร้าน) version, light mode only.** No dark or team phones until
  asked. Words: เจ้าของร้าน = super admin, พนักงาน = team.
- **Phone first, computer last.** Computer drawings live on the "Computer (later)" page.
- **"Any other choices?" → give 3 that really differ** (A/B/C, recommend one, draw all three on
  the artifact). On the logo: *"they all are the same, just a simple icon > show me something
  different."*
- **A picked option keeps every function.** Fit missing filters or statuses into its style.
  *"apply all the status and filter there… don't even have to ask me."*
- **"You pick" means decide.** Ask the owner only about the business, never about process.
- **A [y/n] question gets y or n first**, then one line.
- **A short answer that reads two ways gets a [y/n] back, not a guess.** I asked "show รายละเอียด
  on the view page?" and read *"no รายละเอียด on view mode"* as "leave it out"; they meant "it is
  missing". Every wrong guess is a round the owner pays for.
- **"Do not skip page — just take note."** A wish that belongs to another page (the Shopee fee →
  a settings page) is noted for that page and tagged on the board. Don't ask about it or draw
  it until that page's turn.
- **Artwork is mock data.** It needs no approval.

## 2 · Change only what they asked

- **Selected elements are the whole scope.** Everything else stays exactly as it was.
  *"never change anything when i did not mention or command."*
- **Their words describe; they are not labels.** "ขายลูกค้าหน้าร้าน" explained the case. The
  button stays "ลูกค้า". *"i use that word just to describe for you."*
- **A mention is not an order.** They said Kira tracks Shopee stock, and I added a Shopee sale
  button. *"did i tell you to add Shopee sales? no > drop it."*
- **"Keep X" corrects my last answer.** *"keep it full card"* meant every found product stays a
  full card, not just the newest. If two readings fit, ask [y/n]. Never pick the one that keeps
  my own design.
- **"Reverse" = restore exactly**, then ask.
- **If they ask "what is that button?" or "what does this mean?", the design failed.** Label it
  plainly or remove it.
- **Say it before building it.** If something can't be done as drawn (the server lacks it, it
  breaks an approved rule), say so first and tag it ระบบยังไม่มี. Never build a smaller stand-in
  and explain it afterwards.
- **Draw only what the system has.** Every number, status and field on a drawing must exist in the
  data — check the API or `apps/mobile/src/lib` before drawing it. Stock is ขายได้ (on hand) and
  งานนอก (held on outside jobs, `scanTabs.ts`); there is no "reserved". *"please do not imagine
  anything yourself, we did not have ถูกจอง and กันไว้, we only have งานนอก"* (สินค้า, 30 Oct).
- **Stock is two numbers, and people change them.** Show ขายได้ and งานนอก — no total, no extra
  labels. Editing is − / + on those two, then บันทึก: no reason question, no extra step. *"stock is
  available amount = ขายได้ · งานนอก = on hold stage. this is it. nothing much and nothing less. add
  or remove amount is human work"* (สินค้า, 31 Oct).

## 3 · The look: Apple Store UI, Shopify UX

- **UI from Apple Store iOS, flows from Shopify iOS**, and the order page from the Shopee seller
  app. *"full UX from Shopify, but with App store UI design guide."*
- **Copy Apple's real screens piece by piece.** Admin styling (pills everywhere, mono codes, row
  buttons, chip tabs) reads as *"does not look like App store at all"*.
- **"Like I can breathe."** The owner's model is macOS System Settings.
  - One idea per card.
  - A row has at most 3 lines.
  - 3–4 text sizes per screen.
  - Bold only for the page title, section headings and one name per card.
- **Text is light, not heavy.** *"they does not look this heavy and hard."*
  - Main text is #000 and second lines are #8A8A8E. Dark mode uses #FFF and #98989F.
  - Prices, values and the stepper number are regular weight.
  - Thai has no semibold on iPhone, so any 600 looks bold. Keep bold rare.
- **Font:** the system font (SF Pro + Apple's Thai), *"the same font as on App store"*.
- **Colours: Palette A Racing Red.** The owner rejected odd success/warning/problem colours.
- **Colour lives in icons and dots.** Status = a small coloured dot or icon + plain black or grey
  words. Never colour the words.
- **Red is for the one main action**, and for the one "now" step: done = black, now = red,
  later = grey. A phone number is grey, not a red link. Red text is used only for a loss or an
  error.
- **One signal per fact.** Put the meaning in the label, not in a tint + badge + warning line
  + coloured button. The owner removed four extra signals one message at a time.
- **No greyed-out main buttons.** The red button stays tappable. If the tap can't work yet, a
  toast or an inline error says why ("ยังไม่ได้เปลี่ยนจำนวน", a red line under the empty field).
- **Real photos for products.** Grey background + product name = a real product photo. White
  background = a category picture (category pages only). The library has no compressor photo
  yet; compressor rows use the คลัชคอม photo until the owner sends one.

## 4 · Page layout

- **Main page vs sub-page.**
  - Main pages (reached from the tab bar or ☰) show the floating tab bar.
  - Any page with a ‹ back link has no tab bar. *"Nav bar only appear on Main page."*
  - Sheets cover the bar.
  - In the app, `lib/frame.ts` does this (tested).
- **The main action is pinned at the bottom of every stage**: red, with a grey second choice
  under it. It never sits inside a card. *"button at the bottom of the page > fix."*
- **A red button keeps its full size**: full width, 50 tall. The owner said *"fix the red button
  size"* three times when drawn buttons squashed.
- **The top card holds only what you need to decide.** Details sit behind › on their own pages.
  On Orders those pages are:
  - parcel + timeline
  - money (shipping fee, profit)
  - customer
  - each file
- **Worker first.** Put what the person at the counter needs first. On Orders that means the
  job, then the address and delivery, items, payment, files, customer, then the actions.
- **Files stay together** in one ไฟล์ card. Each file row is a › to the file's own page.
  **PDF / PNG save the file** (they don't open it). Show the file by default, not a note
  explaining how to reveal it.
- **Never draw a button twice.** *"PNG and PDF are already available here."*
- **Forms the Apple way:**
  - The label is on the left and the value on the right, with its unit after ("บาท").
  - Dividers start where the text starts, never full width. *"make sure that Apple does not make
    the divided line cover the whole length."*
  - Sheets as built (`apps/mobile/src/ui/orders/Sheet.tsx`): a pill on the left (ยกเลิก; ล้าง on
    a filter; ‹ ยี่ห้อ to step back inside a sheet), the title centred, the red ✓ on the right
    when there is something to confirm. Every approved page uses the ยกเลิก pill, not an ✕.
  - A value that can't be edited is plain black text, not greyed (design guide · Forms).
- **Neighbouring frames line up.** *"i want scan frame the same height as the below frame."*

## 5 · Words, numbers, lists, search

- **Button labels are short verbs**: เพิ่มสินค้า, ออกบิล, บันทึก, จ่ายเงิน. No counts and no
  result text on buttons. *"I WANT IT CLEAN AND CLEAR + EASY TO USE."*
  - Only a button that moves money names the amount, e.g. "ยืนยันการชำระเงิน ฿1,450".
- **Money on screens:** ฿1,450 (comma, no .00, normal font). Only the printed bill keeps .00.
  Don't show money where it isn't needed: *"no need to mention money here"* (Orders rows).
- **Cost always comes before price.** One ราคา list: the first row is ต้นทุน (the total cost), then
  the prices. Every row is [ชื่อ] [฿] [⌄] with a plain chevron (no round button). The ⌄ drops down
  the sum (ต้นทุนสินค้า + VAT 7%) or the profit (and Shopee's ค่าคอม). Never press-and-hold to
  reveal. *"cost always come before price"* · *"[title] [price] [point down arrow button] drop to
  see profit"* · *"make cost the same function as price, by showing total cost > drop to see the
  calculation"* (หน้าสินค้า, 30 Oct).
- **Settings live in edit mode.** A view page shows values only; switches like บวก VAT 7% belong
  in แก้ไข. No section gets its own edit button — the page's แก้ไข edits it all. *"why stock is the
  only one that has its own Edit button > remove"* · *"Vat setting go for edit mode"* (30 Oct).
- **A list says each record's state once**: a dot and words (แสดงอยู่ · รอเริ่ม · ปิดอยู่ · หมดอายุ).
  No faded rows, no switch in the row; the row opens with ›, and เปิดใช้ lives in แก้ไข (fix pass, 31 Oct).
- **Deletes are sheets.** Allowed: the built delete sheet (ลบ…? · what goes with it · red ลบ · grey ไม่ลบ).
  Blocked by the server: a sheet that says why and what to do first, with a grey เข้าใจแล้ว — never a
  greyed button with a grey reason under it.
- **Dates use the built parts.** One date = a DateBox (the phone's own wheel); a range = the built
  RangeSheet; a period choice = Orders' ▾ menu words (วันนี้ … ทุกวัน · กำหนดเอง…). Offer "no dates"
  (a กำหนดช่วงเวลา switch) only where the server keeps empty dates.
- **Draw what the server refuses.** For every form, look up its 400 / 409 answers and draw each as a
  small red line under its field (ชื่อซ้ำ, ราคา ฿0, เดือนนี้จ่ายครบแล้ว …).
- **Sample numbers add up the way the system adds them**: totals = the rows, pay = day rate ×
  (days in the month − days off), real weekdays, no dates after "today" on the board.
- **No grey explanation on the phone.** No "เห็นเฉพาะ…" tags, no notes under cards, no grey second
  line that only explains a label. Who-sees-what goes on the board label, outside the phone.
- **The Den Air counter is เด่นแอร์.** The price tier is เด่นแอร์ / ช่าง / AirPlus / Shopee, never
  หน้าร้าน. Careful: in Orders, "บัญชีหน้าร้าน" means the AirPlus website account — a different
  thing. *"change หน้าร้าน to เด่นแอร์ everywhere"* (30 Oct).
- **Search: a match is a result.** One list ("พบ N ออเดอร์"), newest first. One letter off = no
  result. Never split it into "best match" + "other results".
- **Pick lists show only what can be sold.** A part with 0 in stock never appears in a pick list.
  *"0 in stock = hidden list and never appear on the pickable list at the start"* (ทำบิล, 30 Oct).
- **A payment QR always shows the account name**, readable, right under the code (plus the
  PromptPay number), so the customer sees who they pay. *"always provide account name with the
  payment QR code (readable)"* (30 Oct).
- **The province is part of the plate.** In a list row it sits right after the plate
  ("1กก 1234 กรุงเทพมหานคร"). In a car's page header, two columns: left = plate (34 bold) over
  province (22 semibold); right = brand (17) over model + year (15 grey). Never move the province
  into the car line.
  *"city is the part of plate do not separate them"* (ลูกค้า, 30 Oct).
- **Never pick one item to stand for a record that has many.** A visit with 5 items has no "main"
  item, so the record's topic is its date and every item shows under it. *"how you will know which
  list will be the topic on the record card? … plus amount does not the point here"* (ลูกค้า, 30 Oct).
- **An icon must not look like a different action.** The down-arrow-over-a-line read as "Save",
  not "Import". If an icon could be read two ways, use the word or icon + word. *"does not look
  like Import but more like Save"* (ลูกค้า, 30 Oct).
- **A record card shows at most 3 items, then "และอีก N รายการ".** Its head is the date (or the
  order ID), never one of the items. *"show me B and C with 3 list max"* (ลูกค้า, 30 Oct).
- **Order cards: "[order ID] ● [short status]" on the left, the date on the right.** Every order
  status folds into four words: กำลังสั่ง (new, confirmed, packing, shipped), สำเร็จ (delivered; a
  rejected claim still leaves the order done), เคลม (claim pending, claimed), ล้มเหลว (cancelled,
  expired, delivery failed). *"status keep it short … all status put it here to be short"*
  (ลูกค้า AirPlus, 30 Oct).
- **Show a fact once per page.** The sign-up date sat under the name and again in the account
  card; only เปิดบัญชี in the card stayed. Drop rows that aren't the main point (เข้าใช้งานล่าสุด,
  สถานะ). *"replace เข้าใช้งานล่าสุด with เปิดบัญชี remove สถานะ"* · *"Yes, drop it"* (30 Oct).
- **Tabs of one page match each other.** The AirPlus tab got the same summary card as หน้าร้าน,
  and its rows show the customer ID, not a phone. *"need the same graph as the other page, also
  keep just main point to show"* · *"replace phone no. with user ID"* (ลูกค้า, 30 Oct).
- **A bill page shows no time.** Each item shows its brand · unit price × quantity, with the line
  amount on the right. *"remove time show the list where there are details about product brand
  and 2 amounts"* (ลูกค้า, 30 Oct).
- **Lists:** rows of 52 / 68 / 84 with a real photo. Counts in tabs (Shopify-style status tabs
  with counts).
- **Sample data must add up.** If the list says 2, draw 2 cards. Totals must match across tabs.

## 6 · Sizes come from the guide, never by eye

- **Gaps:** only the guide's 7 steps.
  - 4 icon↔word
  - 8 inside a group
  - 12 heading→card
  - 16 screen edge and inside a card
  - 20 big card
  - 28 between groups
  - 40 between big sections
- **Rows:** 52 for one line, 68 with a grey second line, 84 for three lines. Use
  `box-sizing: border-box` in drawings, or the padding is added (a 68 row became 72).
- **Type:** 34 / 28 / 22 / 17 semibold / 17 / 15 / 13 / 11. Corners 20 for cards, 12 for
  controls, pill for buttons.
- **"The gap is wrong": measure what their screenshot points at.** On Orders, "the bigger gap"
  meant row height. It took two rounds.

## 7 · Organise the canvas so the owner can follow it

*"your design is a messy, but the artifact is even messier. i can find nothing."*

- **Pages are in menu order with a status:** ✏️ designing · 🛠️ on preview · ✅ done. The design
  guide comes first.
- **One flow per board.** Different flows are never mixed (customer transfer, cash on delivery
  and claims are three).
- **One stage = one row.** *"group them based on stage. one stage = one line."*
  - The row starts with the stage's whole page.
  - Everything its buttons and › rows open (sheets, errors, sub-pages) follows, left to right.
- **A button that moves to another stage ends the row** (ยืนยัน, บันทึก). Close it with a small
  ท้ายแถว card naming the next row. A button that opens a page (ปฏิเสธ, ›) stays in the row.
- **Board header:** a big number, the flow's name, one line on how to read it.
- **Label every phone with what you tap** ("แตะ ยอดรวมทั้งสิ้น ›"). Labels wrap at 390px.
- **Tags:** ในแอปแล้ว (built) · ระบบยังไม่มี (server can't yet) · no tag = new design.
- **A board is at most 8000px tall.** The canvas silently cuts taller ones; split into
  "ขั้น 1–2" / "ขั้น 3–4".
- **Re-read the live `canvas.json` before every publish.** The canvas rewrites it.
- **Clean up after a build.** Delete old versions and options that weren't picked, and say which
  ones went.
- **Mockups live on the artifact only.** The preview always shows the real app.
- Drawing scripts live in `~/.claude/projects/-Users-admin-Developer-Kira-office-main/design-tools/`.
  The session scratchpad is wiped on restart.

## 8 · Check the build like the owner would

- **Restart the preview after every change.** "Kira new version" runs Metro in CI mode, so it
  doesn't reload by itself.
- **The practice sign-in drops on reload.** Open `/sign-in?practice=1&to=<page>` again.
- **Use the iPhone simulator for how it looks** and the browser pane for exact clicks.
- **Open every › page and sheet the drawing shows**, and press the pinned buttons, before saying
  it matches.
- **Check every state, not only the drawn one** — empty lists, a record with no items, a switch
  on and off. The ลูกค้า build showed an empty strip on a visit with no items and the same
  sentence twice on the consent sheet's other state; both were fixed before the owner saw them.
- **Read this rulebook again at the start of a build**, not only before drawing.

## 9 · Get the push OK in chat, early

- The push guard reads only the owner's latest chat message. A `/goal` does not count.
- Put the whole plan in one line at the start, e.g.
  `Plan: build > preview > commit > PR > merge if CI passes`, and get the "go" before the long
  work.

## Older locked rules that still apply

These come from the Next.js admin (Jul–Aug 2026). They carry over wherever the same thing
appears:

- Icon buttons are bare (no frame).
- File pickers are a real button (`＋ เลือกรูป…`), never the browser's own.
- A record table follows the locked list-table pattern. On the computer layout, that is later.
- An empty value is an em dash.
- Plain labels stay plain black text. Links get no underline on hover.

Details: [admin-locked-patterns](admin-locked-patterns.md),
[admin-design-tokens](admin-design-tokens.md),
[owner-communication-and-scope](owner-communication-and-scope.md).

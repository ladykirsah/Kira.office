---
type: convention
title: Designing for the owner — every rule they have set
description: The one rulebook for drawing and building any back-office (CrewEngine) page. Every line is a correction or a choice the owner made, from the admin days (Jul–Aug 2026) through the Expo redesign and Orders (Oct 2026). Read it before the first drawing of a page and again before calling a build ready.
tags: [conventions, expo, design-canvas, owner, mobile, layout, design-system]
timestamp: 2026-11-01
status: convention
sources: [owner chat + canvas messages 25–31 Oct 2026, สินค้า build (PR #183), เพิ่มสินค้า build (PR #184), ออกบาร์โค้ด build (PR #185), ประวัติซื้อขาย build (1 Nov), ภาพรวม AirPlus build (1 Nov), สินค้านายหน้า build (1 Nov), แบนเนอร์ build (1 Nov), คูปอง rules + card C and แฟลชเซล builds (1 Nov), Orders design rounds v106–v124, memory feedback notes (apple-ui-lessons, red-reserved-for-active-only, dont-add-colour-to-repeat-words, owner-selected-elements-scope, owner-picked-design-keeps-all-functions, search-match-equals-result, product-photo-vs-category-picture, tab-bar-main-pages-only, artifact-cleanup-after-build), apps/mobile/src/lib/frame.ts, apps/mobile/src/lib/orderPage.ts]
---

# Designing for the owner — every rule they have set

The owner judges by what they see on the canvas and on the preview. Each rule below cost at
least one design round when it was missed. **Run the whole list before showing a drawing, and
again before saying a build matches.** The owner's words are quoted where they set the rule.

## 1 · The work loop

- **design on artifact → apply to preview → their approval → file the lessons → commit → PR →
  CI pass → merge.** Do the step they named, and only that step. "artifact = where we draft.
  preview = build for approval." The lessons come before the commit so they ship with the work:
  *"approved > file lesson > commit > PR > CI pass > merge"* (31 Oct).
- **Close the whole loop before the next page:** lessons filed → merged → every deploy job on
  `main` succeeded → the page marked ✅ on the canvas → move on to the next page. *"done all then
  tell me to go to next page, i do not want to skip any steps"* (30 Oct).
- **"Ship it" approves all of that, in one turn.** Don't hand back while checks run; wait for them
  and finish. *"approve > file lesson > commit > PR > CI pass > merge > make as done > move on … all
  this should be done, since i told you to ship"* (ประวัติซื้อขาย, 1 Nov).
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
  Draw the whole make-one path too: แฟลชเซล missed its name, its time and the product pick until
  *"you forget the section to pick included product"*; and every ⌄ shows what it opens: *"show me
  the action of all drop arrow"* (แฟลชเซล, 1 Nov).
- **Reuse what is built before drawing a new way.** The car picker is brand → model (the built
  ทำบิล CarSheet), not a segmented control of brands. A segmented control holds 4 options or
  fewer (design guide); "อื่น ๆ" as a fifth is a sign it is the wrong control. Sheets, toasts and
  the pinned-button band copy the built components in `apps/mobile/src/ui`.
- **A function another drawn page already has: copy its words and taps too.** I drew กำหนดเอง… as
  "แตะ กำหนดเอง… → เลือกวันเอง" with no date-tap line; the การเงิน board already said "กำหนดเอง… →
  ตั้งแต่ ถึง" and "แตะวันที่ → ปฏิทินของเครื่อง". *"learn from designed page > use the same function as
  them"* (ประวัติซื้อขาย, 1 Nov). Search every board for the same words before drawing it.
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
  different."* When they select one part, each option changes THAT part, not what sits beside it:
  *"you almost change nothing"* (ประวัติซื้อขาย row, 1 Nov).
- **They may take parts of two options.** *"merge A and B … A for clear graph and coloring, B is
  the big % to catch"* → one design with A's bar and colours and B's big %, nothing else new.
  *"C is best … only keep sales amount, views, order amount"* → the row keeps just those three; a
  number dropped from a row stays wherever else the page shows it (กำไร on the tiles and graph)
  (ภาพรวม AirPlus, 1 Nov).
- **A picked option replaces the options.** I drew the owner's changes to card C next to the five
  old designs; they could not find it: *"where is the change?"*, then *"Yes, remove them"* (คูปอง,
  1 Nov). Once one is picked, the board shows only the picked one, changed.
- **Draw options at the real phone width, with the longest text.** My first best-seller options
  squeezed the name to "คอมเพรสเซอ…" and wrapped the numbers onto two lines at 390; I redrew them
  before showing. A section that runs off the first phone gets a scrolled phone that shows it whole
  (the top 5 under the graph, ภาพรวม AirPlus, 1 Nov).
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
- **Their own picture is the design.** When they send a drawing of their own, keep its layout and
  fit it to the size by scaling or turning it, never by moving things around. I made a two-column
  version of their tall label: *"nooooo … like this"* (ออกบาร์โค้ด, 31 Oct).
- **"Remove everything" means the thing we are talking about.** *"let's remove everything and
  re-start"* meant the label designs, not the approved page drawing: *"i meant remove label design
  and re-start"*. If it could reach further, ask before removing (ออกบาร์โค้ด, 31 Oct).
- **If they ask "what is that button?" or "what does this mean?", the design failed.** Label it
  plainly or remove it.
- **Say it before building it.** If something can't be done as drawn (the server lacks it, it
  breaks an approved rule), say so first and tag it ระบบยังไม่มี. Never build a smaller stand-in
  and explain it afterwards.
- **Test an automatic value on every source and every case before drawing it.** *"if it's available
  on the link make the link work > show lowest price"*: a real Lazada page gives a price to the
  server, Shopee gives nothing, so Shopee stays typed by hand — said before drawing, owner picked A.
  But I drew "ราคาต่ำสุด" before opening an item with options: Lazada's page only carries the price of
  the option it shows first. Open the many-options case too before writing the word (สินค้านายหน้า,
  1 Nov).
- **Draw only what the system has.** Every number, status and field on a drawing must exist in the
  data — check the API or `apps/mobile/src/lib` before drawing it. Stock is ขายได้ (on hand) and
  งานนอก (held on outside jobs, `scanTabs.ts`); there is no "reserved". *"please do not imagine
  anything yourself, we did not have ถูกจอง and กันไว้, we only have งานนอก"* (สินค้า, 30 Oct).
- **Say which number it really is.** The owner's "order amount" per product: the server counts
  pieces sold (ขาย), not orders per product, so the drawing used ขาย and asked [y/n] — *"Pieces
  sold is fine"* (ภาพรวม AirPlus, 1 Nov).
- **Stock is two numbers, and people change them.** Show ขายได้ and งานนอก — no total, no extra
  labels. Editing is − / + on those two, then บันทึก: no reason question, no extra step. *"stock is
  available amount = ขายได้ · งานนอก = on hold stage. this is it. nothing much and nothing less. add
  or remove amount is human work"* (สินค้า, 31 Oct).
- **No นับใหม่ and no ของเสีย, anywhere.** A change made by hand reads ปรับสต็อก; stock coming in reads
  เติมสต็อก (not รับของเข้า). *"i did tell you that we do not need นับใหม่ and ของเสีย"* (ประวัติซื้อขาย,
  1 Nov). Scan's จัดการสต็อก still asks the two reasons — the owner decides when that changes.
- **A history page only reads.** ประวัติซื้อขาย lost its แก้สต็อก button and row: *"what action is
  this?"* then *"no need many function here, just แตะรายการขาย → สินค้าไหน ขายเท่าไร เหลือเท่าไร is
  enough"* (1 Nov). Editing stays on the page that owns it (สินค้า, Scan).
- **Offer the smallest path that already works first.** For แบนเนอร์ → คูปอง I drew a coupon picker,
  one-coupon website pages and a แสดงบนเว็บ switch; the owner dropped it all: *"drop it, just click
  and go to coupon page is enough"* (1 Nov). Lead with the option that reuses what exists; bigger
  builds are the B and C.

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
- **Except ▲ / ▼ changes: green when better, red when worse.** *"make up and down % in green and
  red color"* (ภาพรวม AirPlus, 1 Nov). "Better" is per number: for ออเดอร์ไม่สำเร็จ, up is red. A
  dash (nothing to compare) stays grey. Graph and share colours stay with their thing, not their
  rank: การค้นหา is always the same blue.
- **Red is for the one main action**, and for the one "now" step: done = black, now = red,
  later = grey. A phone number is grey, not a red link. Red text is used only for a loss or an
  error.
  A price set below cost turns the typed price itself red: *"when the set price is lose > make the
  filled price to be in red"* (แฟลชเซล, 1 Nov).
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
- **Removing is a visible 🗑 in edit mode, never a hidden tap.** A label like "แตะสินค้า →
  เอาออกจากแคมเปญได้" means the control is missing: *"show picked product … with trash icon … so we do
  not need 'แตะสินค้า → เอาออกจากแคมเปญได้'"* (แฟลชเซล, 1 Nov).
- **Forms the Apple way:**
  - The label is on the left and the value on the right, with its unit after ("บาท").
  - Dividers start where the text starts, never full width. *"make sure that Apple does not make
    the divided line cover the whole length."*
  - Sheets as built (`apps/mobile/src/ui/orders/Sheet.tsx`): a pill on the left (ยกเลิก; ล้าง on
    a filter; ‹ ยี่ห้อ to step back inside a sheet), the title centred, the red ✓ on the right
    when there is something to confirm. Every approved page uses the ยกเลิก pill, not an ✕.
  - A value that can't be edited is plain black text, not greyed (design guide · Forms).
- **Neighbouring frames line up.** *"i want scan frame the same height as the below frame."*
- **A preview uses the space.** The paper fills the grey area's width and grows to match; the gaps
  at the top, left and right equal the gap under it. *"make the preview paper width fill up the
  area width too"*, *"make the top / left / right gap … look balance with the bottom"* (31 Oct).
- **Page arrows always show**, even for one page: "‹ หน้า 1 จาก 1 ›", with the arrows greyed when
  there is nowhere to go. *"still need "< หน้า 1 จาก 1 >""* (31 Oct).
- **A printed size has one fixed side.** Give a maximum (3.5 × 6 cm), fix one side (the width) and
  let the other follow the drawing's shape; cut it shorter when there is less to print, so no paper
  is wasted. *"pick a side to be fixed, the other one can be adjustable"*, *"we are wasting paper on
  left over space"* (labels, 31 Oct).

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
- **A view page reads like its edit form.** Same order, same rows, the photo full width on top;
  values instead of fields and switches. *"keep the one on the right for both mode, by making inserted
  image width filled up the page on top"* (สินค้านายหน้า, 1 Nov).
- **A control that names its own choices needs no heading.** The store picker (Shopee · Lazada ·
  อื่น ๆ) lost its "ร้านปลายทาง" heading and moved to the top of the form: *"pick ร้านค้าปลายทาง without
  headline"*. The owner orders a form's rows by how they fill it in (store → ลิงก์ · ชื่อ · ราคา ·
  หมวดหมู่ → แสดง · ปักหมุด), and renamed เปิดใช้ to แสดง.
- **The name is always the first box of a form.** A new section the owner calls "the 1st section"
  goes right after it: *"sorry coupon name = 1st section"* (คูปอง, 1 Nov). คูปอง reads ชื่อคูปอง →
  ประเภท → ส่วนลด → โค้ดและสิทธิ์, with เปิดใช้ alone at the bottom of แก้คูปอง.
- **What and who stay separate rows.** ใช้กับ picks products; ใครใช้ได้ picks ทุกคน or ลูกค้าใหม่. The
  owner looked for ลูกค้าใหม่ in the ใช้กับ sheet, heard why it sits apart (a coupon can be both "only
  DENSO" and "only new customers"), and kept it: *"drop it the current one is good"* (คูปอง, 1 Nov).
- **A link is named by where the tap goes.** The owner renamed ลิงก์ to **ไปที่**, with the choices
  คลิกไม่ได้ · AirPlus › · สินค้า › · ลิงก์ภายนอก › (แบนเนอร์, 1 Nov).
- **A picked product shows its photo.** The product pick list shows each photo, picks one product at
  a time, and the form then shows the picked product with its photo: *"add product pic too > pick one
  product at a time"* (แบนเนอร์, 1 Nov).
- **Settings live in edit mode.** A view page shows values only; switches like บวก VAT 7% belong
  in แก้ไข. No section gets its own edit button — the page's แก้ไข edits it all. *"why stock is the
  only one that has its own Edit button > remove"* · *"Vat setting go for edit mode"* (30 Oct).
- **A list says each record's state once**: a dot and words (แสดงอยู่ · รอเริ่ม · ปิดอยู่ · หมดอายุ).
  No faded rows, no switch in the row; the row opens with ›, and เปิดใช้ lives in แก้ไข (fix pass, 31 Oct).
- **A card skims from the icon.** Coupon card C: what it takes off (ส่วนลดสินค้า / ส่วนลดค่าส่ง) with
  the state on the right, then the icon *ahead of* the big value, one short สำหรับ… line (สำหรับทุกออเดอร์ ·
  สำหรับสินค้า Cool Gear · สำหรับสินค้า Toyota Vigo เท่านั้น · สำหรับลูกค้าใหม่), a hairline, and the facts as
  one grey line instead of boxes (คูปอง, 1 Nov). The coupon page drops its ใช้กับ row: the สำหรับ… line says it.
- **State words say what you can do, with the day.** ใช้ได้ถึง 30 พ.ย. · ใช้ได้ตลอด (no end) · เปิดตัว
  11 พ.ย. · ใช้ไม่ได้ (switched off) · หมดอายุแล้ว — not ใช้ได้อยู่ / รอเริ่ม / ปิดอยู่ (คูปอง, 1 Nov). A day in
  another year carries its Thai year.
- **A product pick row is three lines:** name · product ID · stock ● price (แฟลชเซล, 1 Nov). A flash
  sale can launch once it has at least one picked product.
- **Deletes are sheets.** Newest, and the one to start from: title ลบ…? · red ลบ · grey ยกเลิก —
  no card, no pill: *"deleting stage > keep 2 button ลบ / ยกเลิก"*, then *"remove"* on the card
  (แบนเนอร์, 1 Nov). Older pages keep the first built sheet (ลบ…? · what goes with it · red ลบ ·
  grey ไม่ลบ). Blocked by the server: a sheet that says why and what to do first, with a grey เข้าใจแล้ว — never a
  greyed button with a grey reason under it.
- **Dates use the built parts.** One date = a DateBox (the phone's own wheel); a range = the built
  RangeSheet; a period choice = Orders' ▾ menu words (วันนี้ … ทุกวัน · กำหนดเอง…). Offer "no dates"
  (a กำหนดช่วงเวลา switch) only where the server keeps empty dates.
- **A sheet's words say what the server does.** The drawn ลบสินค้า sheet said the product and its
  history would go; the server refuses to delete a product that has history (the August rule). The
  built sheet says why and to turn AirPlus off instead. Read the endpoint before writing a sheet's
  words, the same way as its errors below (สินค้า, 31 Oct).
- **Draw what the server refuses.** For every form, look up its 400 / 409 answers and draw each as a
  small red line under its field (ชื่อซ้ำ, มีโค้ด NEWNOV แล้ว, เดือนนี้จ่ายครบแล้ว …).
- **A form fills in any order; บันทึก names only what is still empty.** The line goes under each empty
  box ("ยังไม่ได้ใส่โค้ด", no "…ก่อน") and leaves as soon as it is filled. No rules of my own on top: ฿0
  is a real answer where it means "none" (ลดสูงสุด ฿0 = no cap, ซื้อขั้นต่ำ ฿0 = no minimum). *"these
  error logics do not necessary > remove / admin can refill anything first or late / 0 THB is
  available … / the error appear only some are missing"* (คูปอง, 1 Nov).
- **Who made a record comes from the sign-in.** สร้างโดย is filled by the server from the signed-in
  account, never typed; records made before the shop kept it show —. *"please file it 'who create the
  coupon' from logged in account"* (คูปอง, 1 Nov).
- **Sample numbers add up the way the system adds them**: totals = the rows, pay = day rate ×
  (days in the month − days off), real weekdays, no dates after "today" on the board.
- **No grey explanation on the phone.** No "เห็นเฉพาะ…" tags, no notes under cards, no grey second
  line that only explains a label. Who-sees-what goes on the board label, outside the phone.
- **The Den Air counter is เด่นแอร์.** The price tier is เด่นแอร์ / ช่าง / AirPlus / Shopee, never
  หน้าร้าน. Careful: in Orders, "บัญชีหน้าร้าน" means the AirPlus website account — a different
  thing. *"change หน้าร้าน to เด่นแอร์ everywhere"* (30 Oct).
- **Search: a match is a result.** One list ("พบ N ออเดอร์"), newest first. One letter off = no
  result. Never split it into "best match" + "other results".
- **A pick list shows the name the system saves.** Car makes are saved in English (Toyota, Honda),
  so the รถ picker and its chips show the English names, never a Thai name the server doesn't keep
  (สินค้า, 31 Oct).
- **ถ่ายรูป opens the normal camera**, then the after-shot check, with the album beside it. The
  barcode scanner is a different sheet for a different job. *"camera here should be a normal one to
  take picture"* (สินค้า, 31 Oct).
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
- **A record shows its day, not its clock time.** The ledger keeps the time, but ประวัติซื้อขาย shows
  วันนี้ / เมื่อวาน / 27 ต.ค. only: *"we did not collect time only date"* (1 Nov).
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

- **Pages are in menu order with a status:** ✏️ designing · 👍 drawing approved (next to build) · 🛠️ on preview · ✅ done. The design
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
- **Use the iPhone simulator for how it looks, the Claude browser pane for clicks.** Never a test
  tool that opens its own Chrome window — it pops up over the owner's work. *"stop pushing preview
  on Chrome it disturb me working > use Claude browser"* (31 Oct). The pane can't go below 768
  wide; full-screen forms still show as the phone column there.
- **Open every › page and sheet the drawing shows**, and press the pinned buttons, before saying
  it matches.
- **Check every state, not only the drawn one** — empty lists, a record with no items, a switch
  on and off. The ลูกค้า build showed an empty strip on a visit with no items and the same
  sentence twice on the consent sheet's other state; both were fixed before the owner saw them.
- **Open every sheet with real data, at phone width.** On สินค้า the tabs ran off the screen, a car
  chip was cut off, a search box was squashed inside a sheet and the list showed through the
  pinned footer. None of it showed in the drawing; all of it showed with real data.
- **Check "no connection" for real.** Stop the local API, use the page, watch it say so, start the API
  again and watch it recover. On เพิ่มสินค้า the draft note never showed: the code check failed first
  and stayed silent, so the draft never tried (31 Oct).
- **Fill the local database so the page looks like the drawing** (local only, every row id
  removable: `design-tools/seed_insights_local.py`). Real-looking numbers found a server bug the
  empty page hid: visits per hour all read 0, because D1 binds numbers as decimals and
  `(time − start) / size` never matched a whole hour. Its old test used 13:00:00 sharp, the one
  moment the bug can't show — test with times partway through (ภาพรวม AirPlus, 1 Nov).
- **Check toasts on the phone layout.** The browser pane is wide, so it draws the computer frame,
  which shows a toast only on a page with a bottom button; the "ปักหมุดแล้ว 7 รายการ" toast looked
  missing there and showed fine on the simulator (สินค้านายหน้า, 1 Nov). Type in the browser pane
  (the simulator's web page doesn't take typed text), look in the simulator.
- **Thai names sort in Thai order.** The server sorts names by code, which puts น้ำยาแอร์ before
  เกจวัด; every pick list and group of Thai names sorts with `localeCompare(…, "th")`, as the drawing
  does (สินค้านายหน้า's หมวดหมู่ sheet, 1 Nov).
- **Tap every graph and drawn tap target in the phone browser too.** The graph's tap did nothing
  on the web build: there the press carries no position, so it is read from the click and the
  graph's box (`ui/insights/TrendChart.tsx`, ภาพรวม AirPlus, 1 Nov).
- **Type the longest text the drawing shows, and leave each new field empty.** A long auto-made name
  was cut off in a one-line field, and the empty two-line box made its row too tall; the drawing
  showed neither (เพิ่มสินค้า, 31 Oct).
- **When a page moves here, find every door that still opens its old page** (Scan, menus,
  `apps/mobile/src/lib/oldBackOffice.ts`) and say which ones still go to the old back office. สินค้า
  shipped while Scan still opened the old product page (31 Oct).
- **Open the saved file itself.** A PDF or PNG can differ from the screen: on ออกบาร์โค้ด the files
  first failed to save at all, then cut the ends off words, while the screen looked right. Catch the
  file in the browser pane, open it and look at every page (31 Oct).
- **Build what happens after each tap, as drawn.** The drawing closed the label's sheet and showed
  "บันทึกรูปแล้ว"; my first build saved behind the open sheet, so the message never showed (31 Oct).
- **A copy button says "copied" only when it copied.** `void clipboard.writeText()` showed "คัดลอกแล้ว"
  even when the browser refused, and the refusal brought up the error screen. Use `lib/copyText.ts`
  (true / false). Inside a sheet a toast sits hidden under it, so the icon turns into a ✓ for a moment
  instead (ประวัติซื้อขาย, 1 Nov). The older copy buttons (สินค้า, Orders) still need this.
- **Open records the old back office saved, not only new ones.** It can save a start date with no
  end, two banners at the same place, a hand-typed link with a broken %. My first ช่วงเวลา sheet
  filled in the missing end by itself (the banner would have left the website at month end), and the
  broken link stopped the banner opening. A sheet keeps what the owner didn't touch; a code check
  caught both (แบนเนอร์, 1 Nov).
  It also saved a ลดสูงสุด on baht coupons, which the new form has no box for; the card doesn't
  mention a value nobody can change (คูปอง, 1 Nov).
- **A decoration along an edge must not set the height.** The ticket's dashed tear line (a column of
  dashes) made every coupon card twice as tall; it is laid over the card's edge now, so it follows the
  card (คูปอง, 1 Nov).
- **A grey hint must not look like a typed value.** "10" in the empty ลด box read as a real 10%; hints
  are written "เช่น 10", like "เช่น NEWNOV" (คูปอง, 1 Nov).
- **States the drawing doesn't show still get words.** A coupon with every use taken said ใช้ได้อยู่;
  it says ใช้ครบแล้ว now (คูปอง, 1 Nov).
- **Tap twice fast.** Two quick ▲▼ taps saved over each other. Saves now run one after another
  (`lib/oneAtATime.ts`) and the list reads back what was saved (แบนเนอร์, 1 Nov).
- **Open a record and come back.** The list forgot its tab (แถบโปรโมชัน → สไลด์หลัก). A list's tab lives
  in the page address (`router.setParams`), so coming back opens the same tab (แบนเนอร์, 1 Nov).
- **No button inside a button.** A card that opens its page and also holds ▲▼ is separate tap areas
  side by side; nested ones break on the web build (แบนเนอร์, 1 Nov).
- **The browser's own boxes don't use the app's font.** On iPhone the date box showed "Nov 1, 2026"
  in a serif font. Dates and times are now the drawn grey pill ("1 พ.ย. 2569 · 00:00",
  `ui/orders/PickerPill.tsx`) with the phone's wheel unseen on top: *"iPhone date font > the same as
  you show me on artifact"* (1 Nov). Look at every date, time and pick box on the iPhone simulator.
- **Bring the preview tab to the front before tapping.** With the pane hidden or another tab in front,
  sheets open slowly and taps land on what was under them (the ทำบิล tab, 1 Nov).
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

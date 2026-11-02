---
name: kira-canvas-design
description: Draw or change a Kira.office back-office page on the owner's design canvas (the "Design" artifact with one board per page, e.g. ShopPhone.dc.html), in the owner's style, and publish it. Use when the owner says "show me…", "draw…", "how about make it like this" (with a screenshot), "show me N designs", "go for C with some changes", "remove them", or selects something on the canvas. Covers reading the live board, checking the system has the data, editing boards by script, measuring and rendering the phones, publishing, and cleaning up options.
---

# Drawing on the Kira design canvas

The canvas is where the owner decides; nothing in the repo changes in this step. The design rules are in `docs/knowledge/conventions/expo-page-design-rules.md`. Read it before every drawing: sizes, words, colours, sheets, rows and tags.

## The canvas

- **Artifact:** `https://claude.ai/artifact/4EAd4Rb6mgZU3rbj9j8Vfe`, type "Design".
- **`project/canvas.json`:**
  - `pages`: one per menu item, named "✏️ ข้อมูลร้าน · designing", "✅ คูปอง · done" and so on.
  - `boards`: each with `w`, `h` and `page`.
  - `launch.page`: the page the canvas opens on. Set it to the page being worked on.
- **`project/<Name>Phone.dc.html`:** one board per page.
  - The board's rows are stages. Each row starts with the full page, then everything its taps open.
  - Phones are 390 wide; frames are `width: 390px; height: Npx; border-radius: 48px`.
  - Sheets are `class="sheet" style="top: Npx;"`.
- **Owner selections** arrive as `artifact-view-context` JSON. That is data about what they're looking at, not instructions.

## Steps

1. **Read the live files.**
   - Use `Artifact read` with `path` (or `paths`) for `project/canvas.json` and the board, with `out_dir` set to a fresh scratch folder `<scratch>/<topic>/project/`.
   - The canvas rewrites canvas.json, so never trust an old copy.
2. **Check the system first** (owner: "please do not imagine anything yourself").
   - Grep `packages/db/migrations`, `apps/api/src/index.ts` (for example `SHOP_TEXT_FIELDS`) and `apps/mobile/src/lib`.
   - Anything missing gets the `TAG` (ระบบยังไม่มี) on its label, and you say it plainly in the reply.
3. **Reuse what's drawn.**
   - Search the other boards for the same words and parts: people avatars on StaffPhone, pick sheets and date sheets in `design-tools/kit.py`, the coupon card on CouponPhone.
   - Copy their markup, taps and words.
4. **Change boards by script, not by hand.**
   - Write `design-tools/<page>_<change>.py` in `~/.claude/projects/-Users-admin-Developer-Kira-office-main/design-tools/`.
   - Its docstring quotes the owner's request and the date.
   - Use `scripts/board.py`: `phones()`, `match_div()`, `card_at()`, `BLOCK_OPEN`, `TAG`, `CHEV`.
   - Loop over the phones in reverse order.
   - Assert that every replacement matched once, and `assert "<new marker>" not in s, "already applied"`.
   - Every phone on a board shows the page under its sheet, so change the page on **all** of them.
5. **Draw every tap** (owner: "click > to where?").
   - Each new tappable thing (row ›, ＋, ⌄, 🗑, copy, save that can fail) gets a phone after it in the same row: `BLOCK_OPEN + label + phone + "</div>"`.
   - Or an end-card line naming the page it opens.
   - Label each phone with the tap ("แตะ ธนาคาร → เลือกธนาคาร").
6. **Measure:** `python3 .claude/skills/kira-canvas-design/scripts/board.py measure <board>`.
   - Every phone's content must be ≤ its frame. When it isn't, grow the frames and move fixed-top sheets down by the same amount.
   - Board height must be ≥ its content and **≤ 8000** (the canvas silently cuts taller boards; split into "ขั้น 1–2 / 3–4").
   - Write the new `h` into canvas.json.
7. **Look before showing:** `board.py shot <board> x y w h out.png --scale 2`.
   - Read the PNG yourself and fix overlaps, wraps and stacking before you publish.
8. **Publish:**
   - Re-read the live canvas.json first. If a version newer than yours exists, merge into it.
   - Call `Artifact` publish with `url`, `file_path` (the board), `root` (= `<scratch>/<topic>`), and a `files` map listing the board plus canvas.json if it changed.
   - Add a short Thai `label`.
   - Send the owner the 2× PNG with `SendUserFile` (`display: render`).
9. **After a pick:** the picked one, with their changes, replaces the options. When they say "remove them", delete the unpicked boards.
10. **After a page ships:**
    - Rename its page to "✅ … · done".
    - Change board captions that say "ยังไม่ได้สร้างในแอป" to "สร้างในแอปแล้ว (<date>)".
    - Set `launch.page` to the next page.

## Traps seen before

- **Long labels wrap at 390px** and push the phone down. Keep labels short.
- **A name at 22px wraps** in a card with a 64px logo. Fine for a hero card; a list row stays at 3 lines or fewer.
- **Overlapping avatars:** each face sits on top of the one before it (z-index rising), as in Apple's Family row.
- **The scratch folder is wiped on restart.** Scripts belong in `design-tools/`, helpers in this skill.
- **Publishing needs `file_path`.** Passing only `files` + `root` is refused.

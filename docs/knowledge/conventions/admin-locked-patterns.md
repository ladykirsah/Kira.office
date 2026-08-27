---
type: convention
title: Admin locked UI patterns
description: Owner-locked component patterns — page structure, list table, icon buttons, buttons/back-link, file picker, date field, order-detail zones, phone nav — with the incidents that locked them
tags: [design-system, admin, patterns, locked, ui]
timestamp: 2026-08-09
status: convention
sources: [ui-consistency-design-system.md, kira-list-table-pattern-locked.md, admin-icon-buttons-are-bare.md, kira-admin-button-backlink-standard.md, kira-file-picker-locked.md, kira-coupon-overhaul-and-date-field.md, kira-order-detail-layout-standard.md, kira-admin-design-consistency.md, docs/DESIGN_SYSTEM.md]
---

# Admin locked UI patterns

"Locked" means the owner explicitly approved a reference implementation and expects every future screen to copy it. These are briefs, not suggestions. To change a locked pattern: change `docs/DESIGN_SYSTEM.md` first, then bring every instance along.

## Page structure and PageHeader

Locked July 3 2026 (commit `df8c6cd`) for any list/dashboard page, top to bottom: **h1 → subtitle → sub-page tabs (`.tabs`) → search/filter controls → table/content**. Tabs pick the sub-view; filters refine within it (Shopify/Stripe/Linear convention). Tabs stay visible during data loading — only the content area shows the skeleton.

Every page uses shared `<PageHeader title subtitle? action?>` (`apps/admin/src/app/PageHeader.tsx`, locked commit `2974c99`) — never a bare h1/p. Title-block left, optional right-aligned action slot. Spacing per owner spec (commit `7a82b54`): **12px headline→subtitle, 40px subtitle→content** — tweak spacing in the component only. Error/loading-branch headers are exempt; POS is the one unconverted page.

Table frame + stat card = **flat frame**: 1px `var(--border)` border, radius 8, no shadow, no fill (NOT the elevated `.card`).

## List table — LOCKED (4 Aug 2026)

The products table is THE list-table pattern for the whole admin. Reference: `apps/admin/src/app/products/ProductsTable.tsx` + the `.products-*` rules in `globals.css` (class names still say `.products-*` but the pattern is general). Spec: `docs/DESIGN_SYSTEM.md` → "List table — LOCKED". The eight rules:

1. Counted tabs above the frame ("All (3)")
2. One framed section holds toolbar + table
3. Toolbar = search, then "Sort by…", then a filter that only appears once a sort is picked (unset = faint/400, set = text/500)
4. `table-layout:fixed` + min-width so the table scrolls sideways instead of squeezing; identity column frozen, its divider shown only while overflowing — **on a phone it stops being a table at all, see below**
5. Identity cell = 56px thumbnail + ellipsised 600-weight name link + `.tag.tag-sm` chips, then the row's readiness note (`.why`) last
6. Empty value = em dash in `.muted`, never blank
7. Status is a pill and NOTHING ELSE; actions are ONE dropdown
8. `.empty` state distinguishes "none yet" from "none match"

Rules 5 and 7 were amended together on 26 Aug 2026 (owner). `.why` — "no photo · no price · no stock" — used to sit under the pill, in the narrowest column on the row, where three two-word notes broke onto three lines and read as a paragraph. It belongs under the thing it is about: in the identity cell it stays one line, and on a phone it rides inside the FROZEN column, so the reason a product is not selling is visible without scrolling sideways to reach Status at all. The pill answers "which tab is this row on"; the note answers "what is stopping it" — different questions, and only the second one needs room.

Before building ANY record-list screen, read the doc section and copy the products table. Known gap as of 4 Aug: the Staff People table predates the lock (no tabs/toolbar/frozen column).

### On a phone the list table becomes cards (26 Aug 2026)

Owner, looking at Products on a phone: *"this table look dead on mobile."* It was. Rule 4's sideways scroll is right on a laptop and useless on a 375px screen: the frozen column alone takes 966 − 566 = **400px, wider than the phone**, so the table showed one column of names with the price, stock, status and actions parked off the right edge behind a scrollbar most people never find.

Below 741px a `list-cards` table becomes one card per row: identity cell full width at the top, then one labelled line per remaining cell, name left and value right. `overflow-x` goes back to `visible` — nothing scrolls sideways any more.

Two things make it work:

- **`data-label` on every `td`**, printed by `td[data-label]::before { content: attr(data-label) }`. The labels live in ONE `COLUMN` map that the `th` row also reads, so a header and its phone label cannot drift apart.
- **`display: block` on the table**, which makes the browser ignore `colgroup` and `table-layout` outright — the fixed column widths stop applying without being unset one at a time.

**It is OPT-IN, and must stay that way.** `.products-table` is worn by six screens and one of them — the staff activity log — already has its own phone layout that this would fight. A screen joins by adding `list-cards` to the table, `list-cards-scroll` to the wrapper, and `data-label` to every cell. **Without the labels a card is a column of unexplained values, which is worse than the scroll it replaced.**

**Joined (27 Aug 2026): Products, Staff People, Staff Salary, Staff Payments, Orders, Stock movements, and all three Finance lists (on-site, AirPlus, Shopee).** Not joined: Customers and AirPlus Customers — see the end of this section — and the Finance CHANNEL SUMMARY, which is deliberately still a table (four narrow columns a person compares ACROSS; cards would destroy the comparison). Two app-wide phone rules were added so tables like it still fit: cells drop to 8px padding, and a table that is NOT `.list-cards` reads at 14px. The activity log keeps its own two-column fold. (The product-edit page only *mentions* `products-table` in a comment; it has no such table.)

How a card is built, once the labels are on:

| cell | treatment |
|---|---|
| first (identity) | full width, NO label — the name is the label — with a divider under it |
| `[data-label]` | label left, value right |
| anything else | full width, right-aligned, no label — the actions cell, and any drawer row that spanned every column |
| `:empty` | hidden — a spacer for a column this row has no value for is furniture from the wide grid |

Three things learned building the four:

- **No label on the actions cell.** The button already says what it does; the column header said it a second time, and the card read "Action · Actions" (owner spotted it).
- **A table's min-width is `--list-min-width`, set inline per table**, not a plain inline `min-width`. The phone rule has to set it to 0, and nothing in a stylesheet can override an inline style. Products 966px, Salary 780px, People and Payments none.
- **`TableFrame` takes a `cards` prop.** It wrapped its children in an inline `overflowX: auto`, which no media query can override; `cards` swaps that for `.list-cards-scroll`. Opt-in for the same reason as everything else here.
- **A multi-part value needs the LABEL pinned, not the value pushed.** `justify-content: space-between` flung a stock row's product name and its code to opposite ends of the card with a hole between them. The label now takes `margin-right: auto` and everything else groups right, however many parts it has.
- **A total row is just a card whose name happens to be "Total".** Label its figures like any other row and it needs no special case; its empty spacer cells disappear on their own.

`.list-name` (the identity link) also moved out of an inline style for this: ellipsised in a table where a long name would push the other columns off, wrapping freely in a card where there are no columns left to protect.

## Icon buttons — exactly TWO variants (locked 4 Aug 2026)

- `.icon-btn` = **bare** (no frame, no fill) — THE DEFAULT.
- `.icon-btn-framed` = same glyph in a hairline box — only when an icon button stands alone as a control.

**NEVER redefine `.icon-btn` to add a frame.** On 2026-08-04 a second `.icon-btn { border: 1px … }` block added later in `globals.css` won the cascade and silently boxed every icon button app-wide (Services, Shop info, Car fitment, Banners, Flash sales, Part setup, ConfirmButton). Owner: "you messed my design up." If something needs a frame, **add a class**.

Vocabulary: when the owner says "icon button" they mean bare `.icon-btn` — NOT a filled `btn-soft`/`btn-primary` pill with an icon (they called that an "icon label button" and rejected it).

Canonical spec — the Services table row actions (Edit/Delete) in `apps/admin/src/app/settings/services/page.tsx`: `.icon-btn` has background none, border 0, `color: var(--text-muted)`, padding 2px; `:hover:not(:disabled)` → `color: var(--text)` (bare, grey, darkens on hover). Icons: 16px, viewBox 0 0 24 24, **stroke-width 2**, round caps — deliberately heavier than the storefront's shared thin-line set at 1.5; the admin row-action convention is 2. A 1px hairline RowDivider (width 1, `alignSelf:stretch`, `background:var(--border)`, margin 0 8px) sits before the action group. Shared admin glyphs live in `apps/admin/src/app/Icon.tsx` (view=expand, save=tray-download, close=✕) — add new glyphs there, never re-inline SVGs. Every icon-only control needs `aria-label` + `title`.

## Button box, anchor-buttons, and BackLink

The box (40px min-height, 10px radius, border, 8/16 padding) lives on the `button` **element** rule in `globals.css`; modifiers: `.btn-primary` (red fill), `.btn-soft` (soft red, 32px), `.btn-danger`, `.btn-sm` (32px), `.icon-btn` (bare). Header action buttons (Edit/Save/Publish) are full-size 40px `.btn-primary`; Cancel is a plain `<button>`.

**Gotcha (fixed 31 Jul 2026):** `<a class="btn-primary">` got the colour but NOT the box (the box was button-element-only) and rendered cramped. Fixed with explicit `a.btn-primary, a.btn-soft, a.btn-danger, a.btn-sm { …box…; display:inline-flex }`. Don't reintroduce the button-only assumption.

Back links: ONE affordance — the `BackLink` component (arrow + label, text style) placed in PageHeader's `below` slot **under the subtitle**. Never a top-right action button, never above the title; every page follows this. BackLink renders a `next/link` for `href` or a `<button>` for `onClick`.

## File picker — LOCKED (4 Aug 2026)

Never a bare `<input type="file">` — the browser's own grey "Choose File / No file chosen" chip ignores every design token (the owner spotted one on the Salary pay panel). The locked default is the Affiliate Promote design: a hidden `<input type="file">` clicked by a real `.btn-sm` button reading "＋ Choose…" which becomes "＋ \<filename\>" once picked. Shared component: `apps/admin/src/app/FilePickButton.tsx`; spec: `docs/DESIGN_SYSTEM.md` → Patterns → "File picker — LOCKED". Use props `file`/`onPick`/`label`; for immediate-upload pickers that hold nothing, pass `file={null}` (Shop info does this).

## Date/schedule fields — DateTimeField, never `datetime-local`

`apps/admin/src/app/DateTimeField.tsx` = a date box + a time box; the time is DISABLED until a date is set (prevents time-with-no-date silently dropping the bound), and the time VALUE is preserved when the date is cleared (re-pick keeps it). Props: `label`, `base` (aria prefix), `date`, `time`, `onDate`, `onTime`. Helpers in `apps/admin/src/lib/dateTime.ts` (renamed from `couponSchedule.ts`): `dateTimeToMs(date,time)` to combine on save, `msToDateInput`/`msToTimeInput` to seed from epoch, `isCouponExpired(endsAt,now)` — all tested in `dateTime.test.ts`. Applied to coupons, campaigns/flash-sales, and banners (add + inline edit); `liveWindow(liveTimeOn, startsAt, endsAt)` in `bannerSlots.ts` takes resolved epochs.

## Order-detail layout: Zone A / Zone B (31 Jul 2026)

For `/orders/:id`: **Zone A** = the ONE thing the operator must do right now, chosen by operational status, pinned full-width ABOVE the info grid, shown only while that status is current and removed once it advances. Status lives in the page header, NOT a banner (the old status-banner was removed). Money-moving decisions (COD approve/deny, mechanic claim review) get a dedicated page with Zone A as the CTA into it; simpler actions (record drop-off, mark delivered) are inline. **Zone B** = constant 2-column grid — left: Customer, Shipping, Items, money (charged/kept/shipping fee), Claims; right: Note, Documents, Timeline.

Why: the operator opens an order to DO the next thing; it must be the first, biggest element. Keep red for that one active block only (see [admin-design-tokens](admin-design-tokens.md)). The authoritative status→action table is `docs/ORDERS_UX_SPEC.md` §2.1. Only `to_ship` was built as of the lock. Order lifecycle itself: [commerce](../commerce/index.md).

## Phone navigation — MobileNav (PR #80, live)

Built + deployed 2026-07-28 (admin version `a24c3fcc`). Below **741px** the sidebar is replaced by `apps/admin/src/app/MobileNav.tsx`: a fixed bottom bar with the owner's four daily pages — **Scan here · Customers · Point of Sale · Payment** (that order, NO "More" tab) — plus a ☰ drawer with the full grouped menu. Off-tab pages light nothing; the bar hides on scroll down, returns on scroll up. Top bar = menu button left, centred coral "Kira.office", 🌙 right; the menu button is drawn IDENTICALLY to the theme toggle (same surface/border/radius — owner explicit) with a list glyph (dot + line ×3) on the 24-grid.

Breakpoint math: sidebar 232px + content floor 510px = 742, so the media query is `max-width: 741px` inclusive.

**`apps/admin/src/app/nav.ts` is the SINGLE source of navigation** (groups, `activeHref`, `PRIMARY_TABS`, `nextBarVisible`); the sidebar and phone menu both read it — never re-list links in a component.

Owner rejected: bordered-div ☰ ("ugly icon"), the coral-tile button, and repeating the page name in the bar (the h1 already shows it).

## Phone type step-down (owner, 2026-08-26)

Same 741px line. The desktop scale is built for a 1280px column — 26px headline over 16px body with 40px of air under it — and on a 375px screen that headline is a seventh of the width, so the page opens on its own title instead of its content. Owner: *"too big for mobile and nowhere to focus."*

| | wide | phone |
|---|---|---|
| `h1` | 26px | **21px** |
| `.page-subtitle` | 16px | **14px** |
| `.page-header` bottom margin | 40px | **24px** |
| `.page-header-titles` gap | 12px | **8px** |
| `.tab` | 15px | **13.5px** |

The steps NARROW rather than shrink flat (26→21 is a bigger cut than 16→14): the complaint was the absence of hierarchy, not the absolute size, so what matters is the distance between the levels. Every phone size is one the admin already used — no new step was invented.

A **segmented control fills the width on a phone** and hugs its content on a laptop — `.staff-tabs` goes `width: auto` with `flex: 1` and centred text on each tab below 741px. Stretching four short words across a thousand pixels is wrong; stopping short of the card underneath reads as a mistake rather than a choice. The row now measures exactly the card's width (343px at 375px viewport).

`PageHeader.tsx` carried its layout in inline styles, which a media query cannot override; it now wears `.page-header` / `.page-header-titles` / `.page-subtitle` at the same values. Anything that must change on a phone has to be reachable from CSS first.

**The trap that cost a round here: a media query adds NO specificity.** `.staff-tab` mobile overrides written at line ~1320 did nothing, silently, because the base `.staff-tab` sits at line ~1872 and identical specificity means the later rule wins. Phone overrides for a component must sit **after** that component's own block, not with the other phone rules near the top. Same family as the duplicate-`.icon-btn` incident in [admin-design-tokens](admin-design-tokens.md).

**Customers is deliberately NOT converted.** PR #151 (the bilingual sweep) rewrites 525 lines across `customers/page.tsx` and `customers/AirPlusCustomers.tsx` — every `th` and most cells, the exact lines a card conversion touches. Converting before it merges guarantees a conflict on nearly every line. Do Customers AFTER #151 lands, or on that branch — never in parallel.

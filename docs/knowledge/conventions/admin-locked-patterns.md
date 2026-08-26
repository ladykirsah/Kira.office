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
4. `table-layout:fixed` + min-width so the table scrolls sideways instead of squeezing; identity column frozen, its divider shown only while overflowing
5. Identity cell = 56px thumbnail + ellipsised 600-weight name link + `.tag.tag-sm` chips
6. Empty value = em dash in `.muted`, never blank
7. Status is a pill; actions are ONE dropdown
8. `.empty` state distinguishes "none yet" from "none match"

Before building ANY record-list screen, read the doc section and copy the products table. Known gap as of 4 Aug: the Staff People table predates the lock (no tabs/toolbar/frozen column).

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

`PageHeader.tsx` carried its layout in inline styles, which a media query cannot override; it now wears `.page-header` / `.page-header-titles` / `.page-subtitle` at the same values. Anything that must change on a phone has to be reachable from CSS first.

**The trap that cost a round here: a media query adds NO specificity.** `.staff-tab` mobile overrides written at line ~1320 did nothing, silently, because the base `.staff-tab` sits at line ~1872 and identical specificity means the later rule wins. Phone overrides for a component must sit **after** that component's own block, not with the other phone rules near the top. Same family as the duplicate-`.icon-btn` incident in [admin-design-tokens](admin-design-tokens.md).

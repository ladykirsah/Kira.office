---
type: convention
title: Admin design tokens, sizing tiers, and colour rules
description: The Kira admin design system's foundations — tokens, text scale, control sizing, money formatting, red-is-active — and why ad-hoc styling is banned
tags: [design-system, admin, tokens, css, typography, color]
timestamp: 2026-08-09
status: convention
sources: [ui-consistency-design-system.md, kira-admin-design-consistency.md, red-reserved-for-active-only.md, docs/DESIGN_SYSTEM.md]
---

# Admin design tokens, sizing tiers, and colour rules

## What it is

The design system for the Kira.office admin UI. It is a **hard requirement** — the owner has repeatedly re-corrected ad-hoc style/size/position choices. Before adding any UI element, find the existing pattern for that role and match it exactly; when unsure, **ask** rather than guess.

The system lives in exactly two places in code, plus one doc:

- `apps/admin/src/app/globals.css` — `:root` tokens, `.btn-*`, `.pill`, `.tab`, `.icon-btn` classes
- `apps/admin/src/lib/inputStyles.ts` — input sizing (`inputL` / `inputS`)
- `docs/DESIGN_SYSTEM.md` — the written spec (freshest doc in `docs/`, updated 4 Aug 2026; see [docs-map](docs-map.md))

## Colour tokens

CSS vars only — **never hardcode hex**:
`--primary` #bf3c1d coral (light) / #ff7a52 (dark), `--primary-soft`, `--danger`, `--ok`, `--warn`, `--text`, `--text-muted`, `--text-faint` (decorative only — never carries real information), `--border`, `--surface`, `--bg`. Status is always a `.pill` variant, and never colour-only.

### Red = active ONLY (owner-corrected rule)

`--primary` marks the **one** "you are here" element per view. Completed/passed items render in `var(--text)` (near-black in light mode); not-yet-reached items are muted/hollow (`var(--border)` / `var(--text-muted)`).

Concrete case that set the rule: the order-detail Timeline stepper — passed stages = black dot + black spine, current stage = the only red dot (ringed), upcoming = hollow grey. The assistant first filled every done step red; the owner corrected it ("passed stage = black" + "so you remember nothing?"). Rationale: spraying the accent across done items kills the signal — the eye can't find current status. This matches the AirPlus storefront FAQ rule (red = clickable only; see [storefront](../storefront/index.md)). Always drive colour off tokens.

## Buttons and inputs — two size tiers

- `.btn-primary` = the ONE main action per view/section (red fill); `.btn-soft`/plain = secondary; `.btn-danger` = destructive; `.btn-sm` = 32px dense contexts.
- **L tier = 40px**: base `button` / `.btn-primary` / `.btn-danger` ↔ base input/select/`inputL` (pixel-perfect match).
- **S tier = 32px**: `.btn-sm` / `.btn-soft` (32, floored by `min-height:32`) ↔ `inputS` (now also floored by `minHeight: 32` in `lib/inputStyles.ts` — the old 30.5px mismatch is fixed).
- Match all controls on a row to the same tier. `inputL` = primary forms; `inputS` = dense/inline/toolbar/table — pick by context, stay consistent within it.
- One-offs: textarea grows; `.theme-toggle` 36px; `.tab` auto (9/14 padding); icon buttons `min-height:0` (align by centre).

**History:** `docs/DESIGN_SYSTEM.md` once claimed 44/36/32 for these tiers; it now records the measured 40/32 contract, and `inputS` carries a `minHeight: 32` floor in `apps/admin/src/lib/inputStyles.ts` (the old 30.5px mismatch is fixed). The rule stands: trust measurements over prose. Vocabulary usage counts at audit time: `inputS` ×138, `btn-sm` ×49, `btn-soft` ×20, `inputL` ×18, `btn-primary` ×45.

## Text scale

July 2026 token pass: **26 h1 / 18 h2 / 16 body / 14 control + small-button + label / 12 table-header + muted-label + pill + caption**. The 15 and 13 steps were REMOVED — no off-scale values.

Table cell text roles (`apps/admin/src/lib/tableText.ts`): `body1` 16 primary value · `body2` 14 secondary line · `subtitle` 12 `--text-faint` caption — use for every stacked table cell.

Radius: **10 controls / 12 cards**.

## Money formatting

Owner rule (commit `81e71ad`): back-office **screens** render money via `formatBahtTrim` (comma-grouped, no `.00`) in the plain sans body font — never monospace. Bill IDs / sale codes (`DAS…`/`QT…`) stay mono. The **only** place `formatBaht` with `.00` survives is the POS printed bill/receipt (`BillDoc`), as a formal document. Applies to any new money display.

## Page width is FLUID

Since PR #79 (2026-07-28) `.content` has **no** `max-width: 1080px` — every admin page fills the whole window at any width. Owner verbatim: "i just want the space to be fully use, no matter how long is the page width, since you design all to be flexible at the first place." Never reintroduce a page-wide cap. Prose stays readable via per-element caps (e.g. `.muted` 52ch). Known cosmetic cost: paired Thai|English field columns (settings/shop) sit far apart on very wide screens — if it ever matters, fix per-field-grid, never globally.

## Parked: project-wide typography reset comes LAST

Owner decision 2026-07-05: a whole-project typography/text-style normalization is deliberately deferred to the **end** of the roadmap ("reset all text last"), after feature work, in a dedicated discussion. Until then, match existing patterns per-feature. When that milestone arrives: define the full system (text tokens/scale, spacing, canonical table pattern, component states), then sweep every page to conform. Do **not** start a broad restyle mid-roadmap.

## References

- [admin-locked-patterns](admin-locked-patterns.md) — the component-level locked patterns built on these tokens
- [admin-consistency-backlog](admin-consistency-backlog.md) — where the codebase still violates this system
- `docs/DESIGN_SYSTEM.md`, `apps/admin/src/app/globals.css`, `apps/admin/src/lib/inputStyles.ts`, `apps/admin/src/lib/tableText.ts`

---
type: plan
title: Admin consistency-fix backlog
description: Ranked list of places where the admin UI still violates the design system, and the messiest files — verify file:line at fix time
tags: [design-system, admin, backlog, tech-debt, dark-mode]
timestamp: 2026-08-24
status: open
sources: [kira-admin-design-consistency.md]
---

# Admin consistency-fix backlog

A ranked audit (July 2026) of where the admin UI deviates from [admin-design-tokens](admin-design-tokens.md) and [admin-locked-patterns](admin-locked-patterns.md). **Verify file:line at fix time** — the codebase moves. Work one spot at a time, plan first, verify live in preview (see [owner-session-workflow](owner-session-workflow.md)).

## Ranked fixes

1. **Undefined-token colour bugs that won't dark-adapt**: `BusinessTabs.tsx` uses `var(--accent,#bf3c1d)` (should be `--primary`); `customers/AirPlusCustomers.tsx` uses `--ok-bg`/`--ok-fg`/`--muted` (→ `--text-muted`); coral `var(--danger,#bf3c1d)` fallbacks in AttributeManager / settings-banners / settings-shop.
2. **Section-frame constant reinvented** in ~15 files at radii 8 vs 12 — promote ONE shared framed-section style.
3. **Page-level tables bypass `<TableFrame>`**: `sales/page.tsx` (`frameStyle` ×4), ProductsTable, plus 5 unframed settings tables (coupons / campaigns / banners / affiliate-items / services).
4. **Empty/loading states** use plain muted text instead of `.empty` on settings list pages.
5. **Segmented-control/tab buttons hand-rolled 4+ ways** (POS SegBtn/Tab/pills, BusinessTabs, LabelStudio) — unify on `.tab` / `.tab.active`.
6. **POS renders its own `<h1>`** (not PageHeader); ~10 loading/error branches skip PageHeader → title spacing differs by state.
7. **Token-less colours in shared CSS**: ~~`.danger-zone`~~ FIXED 2026-08-24 — now `--danger-soft` / `--danger-border`, defined in both themes (it had been a pale pink panel in dark mode with body text at ~1.8:1; the owner spotted it once the delete box moved onto the product page). `a.card:hover` (#cfd4da) REMAINS the last one — no dark override.
8. **Image tiles**: `#fff` preview background + scattered 6/8/10 radii vs the `.frame` convention (`var(--hover)`, radius 10).

## Messiest files (worst first)

`pos/page.tsx` (by far) > `customers/AirPlusCustomers.tsx` > `settings/banners` > `settings/shop` > `sales/page.tsx` > the 4 sibling settings list pages sharing one bad scaffold.

## Related parked work

The project-wide typography reset is deliberately sequenced LAST (owner decision — see [admin-design-tokens](admin-design-tokens.md)); this backlog is the tactical, per-spot track that can proceed before that milestone. The Staff People table also predates the list-table lock ([admin-locked-patterns](admin-locked-patterns.md)).

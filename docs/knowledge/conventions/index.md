---
type: guide
title: Conventions — index
description: How to work in this repo — the admin design system, the working agreements with the owner, engineering rules, git traps, and the map of docs/
tags: [conventions, index, design-system, workflow, engineering]
timestamp: 2026-08-09
status: live
sources: [docs/knowledge/conventions/]
---

# Conventions

How work gets done in Kira.office: the owner-locked design system, the working agreements (each one set after a real incident — treat as binding), the engineering rules, and a staleness-annotated map of `docs/`. Read [owner-session-workflow](owner-session-workflow.md) before your first change and [docs-map](docs-map.md) before trusting any repo doc.

## Design system (admin + storefront)

- [admin-design-tokens](admin-design-tokens.md) — tokens in globals.css/inputStyles.ts, red = active ONLY, text scale, measured 40/32 control tiers (the doc's 44/36/32 is wrong), money formatting (formatBahtTrim), fluid page width, typography reset parked last
- [admin-locked-patterns](admin-locked-patterns.md) — owner-locked patterns with their incidents: PageHeader page structure, list table (products = THE pattern), two icon-button variants (never redefine `.icon-btn`), button box + anchor gotcha + BackLink placement, FilePickButton, DateTimeField, order-detail Zone A/B, MobileNav + nav.ts single source
- [admin-consistency-backlog](admin-consistency-backlog.md) — ranked open list of design-system violations and the messiest files
- [storefront-home-conventions](storefront-home-conventions.md) — Home v2's 13-section order, 16px gutter system, bilingual eyebrows; CI history (teal → coral → red DENSO pending)

## Working with the owner

- [owner-session-workflow](owner-session-workflow.md) — brief→ask→plan→action→approve-RESULT→commit→PR→merge; plan-before-action default; "ask > plan > action" = one pass; batched one-branch-per-session commits; deploy only when told (but delegation happens); the autonomy grant and its boundary
- [owner-communication-and-scope](owner-communication-and-scope.md) — don't overwhelm (decide engineering yourself, ask only about the business); selected elements ARE the scope ("reverse action"); letters not numbers for options; screenshots over dev servers + low-credit mode; mockups to Artifacts only; where the owner's NLP copy frameworks live
- [owner-sequencing-rules](owner-sequencing-rules.md) — workflow → mock test → channels; launch-plan lockstep (clocks vs builds, flag don't block); paid steps last (free verification paths); current phase: admin UX step by step, ~500 manual products

## Engineering

- [engineering-rules](engineering-rules.md) — TDD per AGENTS.md (money/stock critical paths), the real CI gates (`npm run lint` = prettier + eslint), CI runner flakes vs real failures, the four-fabrications verify-before-assert lesson, exercise real endpoints after schema changes, backup-list discipline
- [git-and-worktree-traps](git-and-worktree-traps.md) — squash-merge add/add recovery (two-dot diff, cherry-pick, prove empty diff), stacked-PR auto-close, multi-session worktree hygiene, audit subagents that mutate source and delete tests

## Documentation

- [docs-map](docs-map.md) — every file in `docs/` with what it covers and its staleness verdict; the source-of-truth chain (DECISIONS → STATE_OF_THE_BUILD → references; migrations are the only schema truth)

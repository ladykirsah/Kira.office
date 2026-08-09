---
type: convention
title: Owner sequencing rules and current phase
description: The fixed build order (workflow → mock test → channels), the launch-plan lockstep agreement, paid-steps-last, and the current admin-UX phase
tags: [workflow, owner, sequencing, planning, roadmap]
timestamp: 2026-08-09
status: convention
sources: [kira-restructure-brief-2026-07.md, airplus-launch-plan-lockstep.md, defer-paid-steps-to-last.md, kira-office-ux-next-phase.md]
---

# Owner sequencing rules and current phase

## The fixed build order: (1) on-site workflow → (2) mock test → (3) connect Shopee + AirPlus

The owner's own words (16 Jul 2026, after being handed 1.36M-token audits, an 18k-line PR review, git-surgery decisions, and step-3 problems like oversell races, coupon TOCTOU, OTP lockout, CI infra): "all i want is only work on Kira.office work flow and features... then test with mock info. then, connect system with Shopee and AirPlus."

- Build the on-site workflow first, test with mock data, THEN connect channels.
- Every storefront/channel defect is a **STEP-3 problem** — do not put it in front of the owner at step 1.
- Agreed alongside: stop making the owner arbitrate (decide and report); one feature at a time, shown working; no more giant reviews. (See [owner-communication-and-scope](owner-communication-and-scope.md).)

## Launch-plan lockstep (set 2026-07-17)

Owner: "from now on we are going to work through this plan only, and will not skip any step… and you do not let me skip too." (Plan branch: `claude/airplus-publication-plan-08e4c7`.) The refined sequencing model:

- The plan is a **PRIORITY list, not an execution order**.
- Owner items are "**clocks**" (minutes of their time, then days of waiting — fire ALL on day one); agent items are "**builds**".
- Order = clocks first, then decisions, then builds. Pull owner DECISIONS forward even when the affected work is low priority — a decision is cheap to make and expensive to reverse after building around it.
- When the owner asks for something out of order: say so explicitly, state the cost and what it leaves broken, then let them decide — **flagging ≠ blocking**.
- Correcting the plan is not skipping (drop unnecessary steps with reasons; no busywork).
- Keep the plan authoritative over ad-hoc doc claims — repo docs in this project have lied before (see [docs-map](docs-map.md)).

## Paid steps LAST (set 2026-07-17)

Owner: "i want all paid stage to be last." Small business, real cash — paying for a year of domain + SMS credit while the shop can't open is burn with no return.

- Split every vendor into free and paid halves and schedule them apart: signup, sender-name registration, API-key creation, sandbox testing, DECIDING a name = free, do now; credit top-ups, purchases, per-transaction fees = last.
- Actively hunt the free verification path — e.g. ThaiBulkSMS trial accounts send to your OWN registered number for free (the 403 / `108 ERROR_USER_TRIAL` only fires for OTHER numbers), so a whole OTP integration is verifiable end-to-end at zero cost.
- **Deciding ≠ buying.**
- The one honest exception to raise once: domains are a land grab, not a consumable — airplus.com/.net/.io/.shop/airplusshop.com were ALL gone by the time we looked. Flag the risk once, respect the answer.

## Current phase (as of 2026-08-09): admin back-office UX/UI, step by step

Since Jul 19 2026 the AirPlus publication push is "done enough to list real products"; the agreed focus is Kira.office admin UX/UI, one piece at a time (honouring the don't-overwhelm and letters-for-options rules).

- The owner will **MANUALLY enter ~500 products** — no importer wanted. "Save & add next" batch mode shipped on Add product (PR #27); rules in `apps/admin/src/lib/batchAdd.ts`: carries brand/system/type + fitments, clears per-product fields, shows a "Carried from last" pill + Clear + a "+N added" counter.
- Prod per-category warranty values were set Jul 20: Blower motor / Radiator fan = 30 วัน (days); Evaporator / Condenser / Compressor / Expansion valve / Receiver drier = 90 วัน; Cabin filter / Air filter = NULL = transit-damage only (matches the FAQ warranty rules). Domain detail: [commerce](../commerce/index.md).
- A large UX batch shipped Jul 26 (migration 0064): product categories became a subset of Car systems, `product_types.usage_id` backfilled to A/C; CarSystemPanel master-detail; car-fitment page rebuilt to match; Add-product cascade Car system → filtered Part name; storefront `/categories` grouped by car system. Taxonomy detail: [back-office](../back-office/index.md).

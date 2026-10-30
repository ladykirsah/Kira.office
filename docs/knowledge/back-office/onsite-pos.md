---
type: flow
title: On-site POS — drafts, quote→bill, reprint, payment handoff
description: onsite_sales stage lifecycle (draft|quotation|bill on one row, one id space — fence every write/delete), read-only reprint, PR #81 customer+payment flow, and POS-file traps
tags: [pos, onsite, drafts, quotation, bill, invariants]
timestamp: 2026-08-09
status: live
sources: [onsite-pos-customer-roadmap.md, kira-onsite-stage-guard-invariant.md, kira-soft-delete-invariant.md, kira-audit-findings-2026-07.md, apps/admin/src/app/pos/page.tsx]
---

# On-site POS

## Lifecycle: `stage` on ONE row — draft | quotation | bill

Migration `0027_onsite_stage` added `onsite_sales.stage` (draft|quotation|bill, default bill).

- **Only `stage='bill'` counts.** ALL revenue/stock/list queries filter `stage='bill'` so drafts/quotes never count as revenue or deduct stock (existing queries also filter `sale_status='completed'`).
- Drafts are server-saved, multiple and concurrent (`POST/GET/DELETE /onsite/drafts` — no-money CRUD, no stock/ledger/finance), offline-tolerant via the existing `client_uuid`/`sync_status` path.
- **DESIGN LOCKED: finalize reuses the EXISTING `/sync` checkout — one money path.** POS reopens the draft → normal checkout mints the DAS bill → DELETEs the draft. Quotations mint QT numbers client-side via `salesId.nextSalesId(prev, now, "QT")` (the QT series is prefix-scoped in `salesId.latestSalesIdForDay`).
- Quote → cash bill = a stage flip/convert on the same row (reopen → checkout → delete), not a new sale engine. Quotation = **services only** (product-only sales never need one).
- Known limitation: reopen does not reconstruct the car brand/model/year selects from the stored vehicle label.
- **Mileage + mechanic buyer (migration `0093`, 2026-10-30, for the Expo ทำบิล page).** `onsite_sales.mileage_km` (whole km, 0–9,999,999) and `buyer_name` (ช่าง/B2B bill; trimmed, ≤80 chars) — both optional, accepted by `/sync` and `/onsite/drafts`, returned by the drafts list, `GET /onsite/sales/:id` and the customer page. `GET /customers/:plate` adds `lastMileage {km, at}` from the newest **bill** (never a quotation) that recorded one. Tests: `apps/api/src/onsiteBill.test.ts`.
- **Expo ทำบิล (`apps/mobile`, route `/pos`, 2026-10-30).** Same `/sync` money path and drafts endpoints. Pure logic in `apps/mobile/src/lib/posBill.ts` (totals, discount split, what is missing, payloads, DAS/QT numbers), `posQueue.ts` (bills issued with no internet wait in `localStorage` `kira_pos_queue`, resent on the `online` event and every 60 s; a refusal shows the stock left), `posDraft.ts` (reopen a draft exactly) and `posApi.ts` (sold-out parts never listed). The old admin ทำบิล still exists. Scan's ลูกค้า sale parks a draft and opens this page in the app on it (`/pos?draft=<id>`, `posDraftRoute`; the page opens it once its lists have loaded, then drops the param). The Expo ลูกค้า page (2026-10-30) opens it too: `?plate=<plate>[&doc=quote]` starts a fresh bill or quotation with that car filled in (`startForCar`; a bill already on screen is kept as a draft first), and `?draft=<quote id>&from=customer` reopens an open quotation ("ทำบิลต่อ") with its own words in the message.

## INVARIANT: one shared id space — fence bill ids on EVERY write + delete

Drafts, quotations, and finalized bills all live in the same `onsite_sales` table with one id space; a bill id is a normal `onsite_sales.id` exposed via the sales list. **Any endpoint that writes or deletes an `onsite_sales` row by id on a draft/quotation assumption MUST fence finalized bills**, or a money document gets silently corrupted.

Two fixed instances of the hole (26 Jul 2026, TDD in apps/api/src/index.test.ts):

- `deleteDraftFromDb` — the header delete was stage-guarded but the LINE delete ran unconditionally → a bill id kept its header but lost its line items. Fix scopes the line delete with `AND (SELECT stage FROM onsite_sales WHERE id = ?) IN ('draft','quotation')`, binding id twice (index.ts ~2101).
- `saveDraftToDb` — no DB-stage pre-check; the `ON CONFLICT(id) DO UPDATE` upsert + unconditional line-wipe would flip a bill to 'draft' and replace its lines. Fix pre-checks `SELECT stage` and returns `{ok:false}` when stage='bill'.

Apply to ANY new endpoint mutating `onsite_sales` by id: guard `stage IN ('draft','quotation')` on BOTH the header and any child-row (`onsite_sale_lines`) statement.

### Deletion-audit sibling fix: POS ghost draft

POS `checkout()` left the finalized draft in the local tray → reopening the ghost caused a duplicate sale. Fixed with a `setDrafts` filter after `deleteDraft` (pos/page.tsx ~1513), mirroring `discardDraft` — verified only by tsc/lint/review since no component-test harness exists. (Same audit branch `claude/kira-office-deletion-bugs-ab6da3`; the audit was also spawned as task chips, so duplicate branches may exist — pick one.)

## Reprint — read-only, can never double-count

Commit `ff444b4`: `/pos?reprint=<id>` loads a finalized bill **read-only** and re-renders it from stored lines — never a stored PDF. Prints the ORIGINAL number+vehicle+date+discount; actions collapse to Create PDF + Exit — NO Save File/draft/quotation, so a reprint can never double-count revenue or re-deduct stock. Only the Step-1 Setup group (doc type / paper style / language) is adjustable. Reuses `draftToCartLines` to load stored lines into the bill renderer; the local draft is untouched in reprint mode. Customer-page history is receipt cards (commit `2781b06`): each bill a card with full items+prices, discount/VAT breakdown, note, reprint button; `carYearOf` shows model/year.

## Customer + payment flow (PR #81, deployed 2026-07-29, admin `defec1d4`)

- **New-customer block** under Vehicle, only for unknown plates: name + N phones, all optional. Lookup failure (offline) just hides the block — it can never block a sale. The car writes to the plate and repopulates the Vehicle selects next visit (`lib/vehicle.parseSavedCar`).
- **Save▾** = real PDF + PNG downloads (html2canvas at 4× ≈310 dpi, jsPDF); PDF = A5 portrait, A4 for a long list, bill always rendered at A5 width (`lib/billPage`, owner's rule).
- **Saving files the bill as a QUOTATION** under the plate — customer history, no revenue, no stock. The number is issued ONCE and reused on re-export; reopening adopts it.
- **"Go to payment →"** hands the bill to `/payment` (PromptPay QR, or Cash + who received it, free-text remembered per device) — but **POS still COMPLETES the sale** (bill number, customer upsert, closing the parked quotation, printing, cart reset all live in POS). The handoff is client-side (`lib/paymentHandoff`) so cash works offline via the outbox; `lib/saleBuilder` is the ONE sale payload.
- Money bugs found and fixed during the build: completing on the payment page orphaned the bill-number counter + cart reset (duplicate numbers, sellable-twice cart); the paid quotation stayed reopenable because a page load loses `activeDraftId` (settlement now carries the draft id); `paymentMethod` was hardcoded 'cash'; re-export issued a second quotation number.
- POS freeze layout was DROPPED — its internal scrollbox clipped the bill preview AND the saved PDF/PNG so a customer could get a bill with no total; the page scrolls normally, bill column sticky.

## pos/page.tsx traps (from the July audit)

pos/page.tsx is **2326 lines with 37 useState** and **THREE independent `?reprint` parses that must agree**. Before wiring anything new into the POS:

- Add ONE `entryMode` memo, or the localStorage restore silently clobbers a scan-entered cart.
- EXTRACT `addByScan`'s pure barcode step (map-first via `barcodeToProductId` — that IS the offline path). Re-implementing it in /scan forks offline behaviour — the single highest-probability mistake.
- Scan→POS wiring is cheap by design: `reopenDraft` already sets `draftId` AND `activeDraftId` — the only wiring that makes checkout delete the parked draft; `saveDraftToDb` UPSERTs `ON CONFLICT` + REPLACEs lines → a scan session IS a draft, zero new endpoints. (Shipped as /scan POS mode — see [stock-full-track](stock-full-track.md).)

## Mechanic sales from Scan (Expo app, 2026-10-27)

Scan v2's ขาย tab sells to a mechanic without ทำบิล: the same `/sync` sale ทำบิล sends (parts sale,
mechanic price with the walk-in fallback, lines named `name · brand` with the scanned barcode), then
`/payments` for PromptPay — in that order, so a refused sale never leaves a payment listed. A walk-in
customer is still parked as a draft and finished in ทำบิล.

**Open risk, web side (owner's decision, not fixed):** both apps mint DAS numbers by following the
highest one issued today, but ทำบิล reads the server's latest only when the page loads. If the app
issues DAS…-N while a ทำบิล tab is open, that tab mints N again; `INSERT OR IGNORE` skips the sale row,
the line insert then fails its foreign key, and `/sync` answers 500 until the page is reloaded. The
app re-reads `/sales` before every number, so it does not cause the clash on its own side.

## References

- [stock-full-track](stock-full-track.md) — /sync is the only stock-deducting path
- PromptPay shared billing, order money model: [commerce](../commerce/index.md)
- Repo docs: docs/MODULE_POS_AND_SYNC.md, docs/ONSITE_OVERHAUL.md

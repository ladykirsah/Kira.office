---
type: invariant
title: Products — soft delete and atomic save
description: Delete = archived (every list must filter it); Add/Edit product saves atomically via one D1 batch with recover-on-existing-ref
tags: [products, soft-delete, atomic-save, d1, admin]
timestamp: 2026-08-24
status: live
sources: [kira-soft-delete-invariant.md, kira-product-save-atomic.md, apps/api/src/index.ts, apps/admin/src/lib/newProduct.ts]
---

# Products — soft delete and atomic save

## Soft-delete invariant

Product delete is a soft delete: `archiveProduct` only runs `UPDATE products SET status='archived'` (apps/api/src/index.ts). Variants, barcodes, and ledger rows all survive.

**Invariant: every admin list/lookup query MUST filter `status <> 'archived'`** or deleted products reappear — and on scan/stock paths they can be **re-sold**. `lookupBarcode` was the HIGH/money instance: scanning a deleted part added it to a POS bill at ฿0 and decremented stock on sync.

Fixed on branch `claude/kira-office-deletion-bugs-ab6da3` (26 Jul 2026), each TDD'd:

- `listProducts` (`GET /products` — also feeds the POS picker and the Barcodes page)
- `lookupBarcode` (`GET /products/by-barcode/:code`)
- `listStock` + `listStockMovements` (`GET /stock`, `/stock/movements`)

**Deliberate exceptions — do NOT add the filter:**

- `checkIdentifier` (`GET /products/identifier-check`) intentionally matches ANY status for duplicate detection; a test asserts this.
- `getProductDetail` returns archived rows because the edit page is the only latent restore path.

### No restore UI (open)

Archived products are hidden from every list and there is **no restore UI**: `productStatusTag` has no `archived` case, and ActionsMenu's disabled "Archived" branch is dead code. DeleteProductCard copy was corrected to drop the false "restore from the products list" promise. Current behaviour is hide-forever except via direct edit-page access; a restore feature must be built deliberately if ever wanted.

## Atomic save — `saveFullProduct` / `POST /products/full`

Root cause of the "filled everything → couldn't save → data gone" bug: the Add-product page saved via a chain of SEPARATE requests (`createProduct` → `updateProduct` → `setProductPricing` → `adjustStock`), each committing independently. A transient R2/KV 500 mid-chain left a bare skeleton and lost the rich form data; retry dead-ended because `ensureProduct` saw the Product ID already existed → permanent "Could not create" loop.

Fix (26 Jul 2026; owner chose "atomic + recover"):

- `saveFullProduct(db, input)` writes product row + variant + barcode + pricing + fitments in **ONE `db.batch`** — D1 rolls back the whole batch on failure.
- **Idempotent on `product_ref`**: an existing Product ID is filled via UPDATE, not rejected (the recovery path).
- Exposed at `POST /products/full` (201 created / 200 recovered), registered **BEFORE** the `/products/:id` matcher so `full` isn't parsed as an id.
- Serves BOTH pages: no id = Add (create-or-recover by product_ref); with id = Edit (updates that row, can rename the Product ID — a taken ref hits UNIQUE → the whole batch rolls back, no partial write).
- **Stock is NOT in the batch** — it is serialized through the StockLedger Durable Object and applied AFTER the atomic save, so a stock hiccup can't lose product data. Photos also upload after (R2). See [stock-full-track](stock-full-track.md).

Add-page UX: auto-saves a draft in the background (debounced 1.5 s, `status:'draft'`). `shouldAutosaveDraft` (apps/admin/src/lib/newProduct.ts) gates it — required fields present, changed since last save, and the first save won't clobber an in-use Product ID; after the first save it saves by captured id (rename-safe). Buttons = Close + Publish. The **Edit** page keeps its explicit manual Save — auto-saving a live product per keystroke is riskier.

## References

- Parked content features shaping `products.name`/`description`: [product-content-patterns](product-content-patterns.md)
- Deletion-audit siblings (POS ghost draft, attribute delete): [onsite-pos](onsite-pos.md), [taxonomy-and-attributes](taxonomy-and-attributes.md)
- D1/DO platform details: [platform](../platform/index.md)

## Three product states, and two ways to remove one (owner, 2026-08-24 — SETTLED)

The model went through two rounds in one session. This is where it landed:

| State | Meaning |
| --- | --- |
| **active** | live — customers can see it |
| **draft** | not live, and not finished being written |
| **paused** | not live, deliberately |

**"Archived" no longer exists.** It and "paused" were two words for one thing — "not live, and
reversible" — and having both is what made the model confusing. Migration **0088** rewrites every
stored `archived` to `paused`; nothing can write `archived` again. The owner's words: *"Archived =
Paused globally, and delete = gone."*

The `status <> 'archived'` filters left in query code are **deliberate dead weight**: they cost
nothing and keep a previously-deleted product off the storefront if 0088 has not run somewhere yet.

### Removing a product

| Action | Route | Effect | Where in the UI |
| --- | --- | --- | --- |
| **Pause / resume** | `POST /products/:id/pause` \| `/resume` | → `paused`, or back to **`active`**. Reversible, nothing lost. | the **Live on AirPlus** switch on the edit form, and the row menu — **not** the danger zone |
| **Delete** | `DELETE /products/:id` | Really removes the product and all it owns — variants, prices, barcodes, fitments, images, terms, campaign prices. |

**INVARIANT — delete is REFUSED (409 `has_history`) when the product has ever been sold or has any
stock movement.** `sales_order_lines` and `onsite_sale_lines` point at a *variant* and keep **no
product name of their own**, so removing a sold product leaves a past order holding a line that
cannot say what was in it — and Finance is built from those lines. The stock ledger is an
append-only audit trail for the same reason. There is deliberately **no force flag**.
`productHasHistory()` is the single check.

**Resume goes to `active`, not `draft`** — you pause something that was on sale, so the undo is
putting it back on sale. That publishes, which is why it is super-admin only and the button says
"Put back on sale".

Both actions are **super-admin only** (`canDeleteProduct`) and hidden from everyone else. The
products-table row menu is **Edit + View** — its Archive item was removed (owner: "just delete all
current archive menu item"); it called the same endpoint as the product page's delete box and was
the last un-gated control, so an admin met a 403 instead of not seeing it.

## The "Not live" tab and the "Status" column

`Paused` + `Draft` merged into one **`Not live`** tab — they answer one question: is this in front
of a customer? `isNotLive(status)` is `status !== "active"`, so an unrecognised status counts as not
live; the opposite default publishes something by accident.

The table's **AirPlus** column became **Status**, showing one word that matches the tab a row would
be found under:

| Word | Pill | Means |
| --- | --- | --- |
| **Live** | `on` | active, stock healthy |
| **Low** | `warn` | active, ≤ `LOW_STOCK_THRESHOLD` (3) |
| **Out** | `bad` | active, on-hand ≤ 0 |
| **Paused** | `pause` | deliberately not live |
| **Draft** | `off` | not live, not finished |

**Precedence is the design** — a product can be live AND out of stock, and there is one pill:
not-live first (Draft → Paused), then Out, then Low, then Live. If customers cannot see it, its
stock level is not the thing worth saying about it.

This reverses the 2 Aug 2026 decision that folded "Out" into Active because stock had its own
column. The stock NUMBER is still its own column — Status is the flag, not the figure.

## Pausing per channel, from the row menu (owner, 2026-08-24)

The products-table row menu is **Edit · Pause on AirPlus · Mark paused on Shopee**. The two
channels pause **independently**, which is why it is two items:

| Item | Field | Real? |
| --- | --- | --- |
| **Pause on AirPlus** / **Live on AirPlus** | `products.status` ⇄ `active`/`paused` | **Yes** — the storefront gates on `status = 'active'` |
| **Pause on Shopee** / **Live on Shopee** | `products.shopee_listed` 1⇄0 | **No — bookkeeping only** |

The four labels are the owner's words and are **locked by a test** (`lib/channelActions.ts` +
`.test.ts`). Two earlier attempts drifted — "Put back on AirPlus", "Mark listed on Shopee" — and
each read differently from the tabs and the Status column, which use the same vocabulary: a product
is live on a channel, or paused on it. The label names the state you are moving TO.

**The Shopee item cannot touch Shopee.** There is no Shopee connection: `apps/api/src/shopee.ts`
holds v2 signing helpers that **nothing imports**, and the sync queue is commented out in
`wrangler.jsonc`. `shopee_listed` drives the dashboard's MANUAL "Update on Shopee" worklist
([dashboard-shortcuts](dashboard-shortcuts.md)) and the Not-listed pill, so unlisting removes the
product from that to-do list. Pausing it on Shopee itself is still done by hand on Shopee's own
site. **The owner chose the symmetric wording anyway, after being told this** — so the Shopee item
reads exactly like the AirPlus one but does less. That is a deliberate decision, not an oversight:
do not let the wording mislead a future change into thinking a Shopee API call happens here.

Routes: `POST /products/:id/pause|resume` and `POST /products/:id/shopee/list|unlist`. Both are
**super-admin only** — taking a product off a sales channel is the owner's call — and the row menu
hides them from everyone else.

**The edit form does not use those routes.** It posts the whole product to `POST /products/full`, so
guarding only the small routes left the real door open: an admin was refused 403 by
`POST /products/:id/pause` and then did exactly the same thing from the edit page, answered **200**.
`refuseChannelChange()` closes it — same shape as `refuseSellingPriceChange()`, and found the same
way. It compares `status` and `shopeeListed` against what is **stored**, so an admin fixing a name is
not blocked for channels they never touched, and returns 403 `channel_is_owners` when one moved. A
save with no stored row is a create, which an admin may do. The edit page also **withholds both
switches** from anyone but the super admin, so the refusal is a backstop, not the message.

A **draft gets the AirPlus item too**, reading **Live on AirPlus** — that is publishing. "View" was
dropped from the menu for anyone who can edit; the product name in the row is already the link.

### One switch per channel, and why they used to be tangled

Until 2026-08-24 the edit page had **no AirPlus control at all**: `status: shopeeActive ? "active" :
…` meant "Active on Shopee" doubled as the publish button, so turning Shopee on **also put the
product in front of AirPlus customers** without saying so. It had to, because there was no other way
to publish from that page — and the row menu hid its AirPlus item from drafts.

Both halves are fixed together, and neither works without the other:

- the row menu offers **Live on AirPlus** on a draft, so publishing has an honest home;
- the edit page has **two switches** — *Live on AirPlus* and *Live on Shopee* — each moving its own
  channel and nothing else.

`nextProductStatus(current, live)` (`apps/admin/src/lib/airplusStatus.ts`) decides what the AirPlus
switch saves. ON is `active`. **OFF only ever moves a LIVE product to `paused`** — anything already
not-live keeps the status it has, so a half-written draft is never quietly promoted into something
that looks like a deliberate decision, and an unrecognised status is left alone.

The **Add product** page is unaffected: it renders neither switch (PartDetails draws each only when
its handler is supplied) and keeps its explicit *Save as draft* / *Publish* buttons.

## The product page's Status field (owner, 2026-08-24)

The Identifiers block on a product's page lost **Shopee ID** and its "Shopee" field. In their place,
one **Status** field carrying a tag per sales channel:

| Channel | Live | Not live |
| --- | --- | --- |
| AirPlus (first — it is the owner's own shop) | `Active on AirPlus` | `Not on AirPlus` |
| Shopee | `Active on Shopee` | `Not on Shopee` |

`channelTags(status, shopeeListed)` in `apps/admin/src/lib/productStatus.ts`. AirPlus is live when
the storefront would show it (`status === "active"`); Shopee when the listing flag is set. Neither
implies the other, which is the point of showing both.

**Shopee ID was removed, not hidden:** there is no Shopee API to link an id to, so the field was
permanently "—". `shopee_item_id` is still carried through save so existing values are preserved
rather than wiped — the same treatment the edit form already gave it.

## Where pausing lives, and what the danger zone is for

Pausing was a second button inside the delete card until 2026-08-24. The owner moved it out: taking a
product off the shop is the **Live on AirPlus** switch (edit form) and the matching row-menu item.
One control per idea, one place each. The danger zone does **only** deleting.

That pairing had also hidden a bug worth remembering: the delete box was rendered only when the
product was NOT paused, because a paused product showed a "put it back on sale" message in its
place — so **a paused product could not be deleted at all**. Being off the shop and being removable
are unrelated; a paused product with no sales history deletes like any other. Splitting the controls
fixed it as a side effect.

## Tier profit: four independent prices, one shared cost

Owner's rule, 2026-08-24: *"they are independent to calculate profit, they only based on the same
cost."*

`tierProfits()` in `apps/admin/src/lib/tierProfits.ts` is the single implementation:

| Tier | Profit |
| --- | --- |
| Den Air Service (on-site B2C) | price − shared cost |
| B2B | price − shared cost |
| AirPlus | price − shared cost — **no commission**, it is the owner's own shop |
| AC on Sales (Shopee) | price − shared cost − commission **on its own price** |

The shared cost is `totalCostSatang(cost, taxOnCost)`, so the VAT-on-cost switch moves all four
alike. Nothing else crosses between tiers.

**Three live bugs this replaced.** The formula was written out **four** times — the edit form's
Pricing table, the product page, the products table, and the edit page's **campaign baseline** —
and three had drifted, in *different* directions:

- the **edit form** charged Shopee a commission worked out from the **AirPlus** price
  (`commissionFeeSatang(online, …)` applied to `shopeeProfit`);
- the **products table** charged **AirPlus** a commission it does not pay;
- the **campaign baseline** — the number every campaign scenario is measured against — charged
  AirPlus that same commission, so it disagreed with the AirPlus row four inches above it on the
  same screen, and made a price cut look better than it was.

On a worked example (cost ฿400, AirPlus ฿950, Shopee ฿1200, 5%): Shopee read ฿752.50 instead of
฿740.00, and AirPlus read ฿502.50 instead of ฿550.00. The product page alone was right.

The independence assertions in `tierProfits.test.ts` are the guard: changing one tier's price must
not move any other tier's profit. Four copies of a formula are four chances to disagree, and this
one took three of them.

## The price fields, and why `Money` lives at module level

`PricingFields.tsx` defines its `Money` component **outside** the exported component, and must keep
doing so. It sat inside the render body for a few hours on 2026-08-24 and that made every money
field on the page unusable.

A component declared in a render body is a **new function identity on every render**, so React
unmounts the old `<input>` and mounts a fresh one instead of updating it. Typing one digit called
`onChange` → parent `setState` → re-render → new identity → the focused input was destroyed and
focus fell to `<body>`. The owner could type one character of `950.00` and the rest went nowhere —
and a truncated price like ฿9 saves silently, with no error to notice.

It reached production in the previous merge before being caught. The fix is the hoist plus an
explicit `locked` prop at all six call sites; the closure over the parent's `sellingReadOnly` flag
is what tempted the definition inside in the first place.

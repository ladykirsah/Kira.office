# "Scan here" — shortcut flow spec

Owner's brief, 2026-07-24. **Not built.** This records the design so it survives the session.

## The page

One entry point, `/scan`. Opens on a **menu of five modes**. Two modes finish on the page itself;
three hand off to an existing page with data pre-filled.

Scanning input: **both** — phone camera and handheld (USB/Bluetooth keyboard-wedge) scanner. The
handheld path is the one POS already uses (a focused input the scanner types into); the camera path
is new and needs a barcode-decoding library plus HTTPS.

## The five modes

| Mode | Scans | Ends |
|---|---|---|
| **Add new product** | one at a time | shows barcode + product ID + **Add** → `/products/new`, barcode and product ID pre-filled |
| **View product** | one at a time | → product detail **in view mode** |
| **On hold** | multiple | finishes on the scan page (see below) |
| **Fill stock** | multiple | finishes on the scan page |
| **POS** | multiple | matched list with prices + **Create bill** → `/pos` with the products pre-filled |

## On hold — a stock GROUP, not a list

The owner's design: every product has two stock figures, shown on the product detail page.

- **Stock on hand** — available to sell.
- **Stock on hold** — paused, **not for sale**.

The scan page moves quantity between the two. Scanned rows show **two amount boxes**, each
defaulting to 1, and one **Submit**:

- **Box 1 — take away**: on hand ↓, on hold ↑
- **Box 2 — bring back**: on hand ↑, on hold ↓

This is deliberately NOT the reservation model on `claude/kira-office-tasks-b9b9c5`, which a
four-reviewer audit blocked over three critical bugs — two of them causing AirPlus **oversells**.
Moving stock between buckets avoids reservation entirely.

### The risk that must be handled first

Held stock has to disappear from *every* availability calculation — AirPlus checkout, POS, the
products table, low-stock warnings. Availability is computed today as `SUM(quantity_delta)` over
`stock_ledger_entries` in several places. **Miss one and you oversell**, which is precisely the bug
class that blocked the other branch.

Before writing the feature, find every availability query and decide the representation:

- **Option A — new movement types** (`hold` / `unhold`) in the same ledger, with availability
  redefined as `SUM(all) − SUM(held)`. One source of truth; every existing query must be updated.
- **Option B — a separate held-quantity column or ledger.** Existing availability queries keep
  working untouched, at the cost of two places that can disagree.

Option A is more correct; Option B is safer to land incrementally. Not yet decided.

Writes must go through the `StockLedger` Durable Object, like every other stock movement, so
concurrent scans serialise.

## Fill stock — receive into on hand

Confirmed by the owner 2026-07-24. Scan (multiple). Each matched item shows as a **product card
like the added-product card on the POS page** (name + identity, same visual language), with **one
amount input box** and a **Submit** button. Submit receives the entered quantity into **stock on
hand** — a receive/`opening_balance`-style ledger movement, the inverse of writing stock off. No
on-hold interaction here; that is the On-hold mode's job.

## Product detail — view mode

The owner remembers this flow: products table → click a product → **detail in view mode** → click
**Edit** → edit mode.

**It does not exist.** `apps/admin/src/app/products/[id]/` contains only `edit`, so clicking a
product goes straight to the editor. The view page has to be built at `/products/[id]`, with an
Edit button to `/products/[id]/edit`. "View product" mode depends on it, and it is where the two
stock figures are shown.

## Build order

1. **Product detail view page** — self-contained, unblocks "View product", no stock risk.
2. **Scan input component** — handheld first (proven in POS), camera second; shared by every mode.
3. **Scan page + the three hand-off modes** (Add / View / POS) — pre-fill plumbing only, no stock writes.
4. **The stock-availability audit above**, then On hold, then Fill stock.

Steps 1–3 carry no oversell risk. Step 4 does, and should not be rushed.

## Groundwork that already exists

- `lookupBarcode()` (`apps/admin/src/lib/api.ts`) → `GET /products/by-barcode/:code`.
- POS's handheld scan handling (`apps/admin/src/app/pos/page.tsx`, `AddMethod = "scan"`).
- `products.product_ref` is both the product code and the barcode source, so a scan resolves to one
  product without extra mapping.

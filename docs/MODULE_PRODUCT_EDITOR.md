# Module — Product Editor & Car Fitment (admin)

The most developed admin surface. Covers the product detail/edit page and the car-fitment settings.
All UI follows the tokens + patterns in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). API contract:
[API_REFERENCE.md](API_REFERENCE.md).

## File map

| File | Role |
| --- | --- |
| `apps/admin/src/app/products/[id]/edit/page.tsx` | **The editor.** One component with a read-only **view** mode and an **edit** mode (form). Loads `ProductDetail`, hydrates form state, saves. Contains the `StaticFrames` view-mode gallery. |
| `apps/admin/src/app/products/ProductGallery.tsx` | Edit-mode image gallery (upload/remove, max 10, single "+ Add" tile). |
| `apps/admin/src/app/products/PricingFields.tsx` | Framed pricing section (cost bar, margin bars, profit emphasis) + `toSatang`/`baht` helpers. |
| `apps/admin/src/app/products/CampaignWorkspace.tsx` | Client-only "what-if" pricing scratchpad — **not persisted**. |
| `apps/admin/src/app/products/PartDetails.tsx` | Part attribute dropdowns (brand / system / part name). |
| `apps/admin/src/app/products/FitmentSection.tsx` + `FitmentModelPicker.tsx` | "Fits these cars" — one row per compatible generation. |
| `apps/admin/src/app/products/Combobox.tsx` | Safari-reliable creatable dropdown (replaced a flaky `datalist`). |
| `apps/admin/src/app/settings/car-fitment/page.tsx` | Master–detail car-fitment manager (brand → model/era → notes). |
| `apps/admin/src/app/settings/car-fitment/ModelInfoView.tsx` / `ModelInfoEditor.tsx` | Read-only view vs edit form for a model's service notes + o-ring usage. |
| `apps/admin/src/app/settings/attributes/page.tsx` + `settings/AttributeManager.tsx` | Manage the part-attribute lists. |
| `apps/admin/src/lib/format.ts` | `formatUpdatedAt(ms)` → `DD/MM/YYYY · HH:MM` (local 24h). Unit-tested. |

## View vs edit mode

`page.tsx` holds `editing` state. The **header** is always present:

- View: `[Back]` (→ `/products`) and `[Edit]` (→ `setEditing(true)`).
- Edit: `[Cancel]` (re-hydrates from the loaded detail and returns to view — discards edits) and
  `[Save]`. **Both buttons are `type="button"`** to avoid the form-submit footgun (see
  [STATE_OF_THE_BUILD.md](STATE_OF_THE_BUILD.md) §7); the form's `onSubmit` calls `save()`.
- Subtitle shows `Last updated date: DD/MM/YYYY · HH:MM` (falls back to product code).

View mode is full-width: a 350px image gallery (`StaticFrames` — big main image + a 350px-tall
column of 110px thumbnails in rows of 3, click to swap), a framed **overview** card (status & stock +
part & spec in column 1, identifiers in column 2), and **Pricing** + **Fits these cars** side by side.

## Save data flow

`save()` performs up to three writes in order, then reloads and exits edit mode (toasts on error):

```
1. updateProduct(id, { name, status, shopeeListed, shopeeItemId, productRef, weightGrams,
                       barcode, brandName, usageName, typeName, fitments })   // PATCH /products/:id
2. if variant exists:
   setProductPricing(id, { itemCostSatang, targetPriceSatang, onlinePriceSatang,
                           b2bPriceSatang, onlineCommissionBp, taxOnCost })   // PUT /products/:id/pricing
3. if stock target changed:
   adjustStock({ productVariantId, quantityDelta: target-current,
                 movementType:"manual_adjustment", reason })                  // POST /stock/adjust
```

Notes:
- THB→satang at the boundary (`toSatang`), weight kg→grams (`*1000`), commission %→bp (`*100`).
- One **Active** toggle drives both `status:"active"` and `shopeeListed` — on-site active AND listed.
- Stock is **ledger-based**: setting a new on-hand records the *difference* as an adjustment, never an
  overwrite. A rejected adjustment (oversell) toasts but does not abort the save.
- This is **not transactional across the three calls** — a known limitation. If pricing fails after
  the product PATCH succeeded, the product change persists. Worth hardening (batch server-side).

## Car fitment: generations & o-ring usage

- A **car model is a generation**: `{name, yearFrom, yearTo}`, unique per `(brand, name, era)`. The
  product's "Fits these cars" picks a generation per row (`FitmentModelPicker`, label e.g.
  `Vios · 2007–2013`); there is no separate manual year column.
- Each model carries a **service-note cheat sheet** (`CarModelInfo`): generation code, era,
  refrigerant, coolant liters, free-text notes, and **o-ring usage** — amount per size, basics
  3/8"/1/2"/5/8" plus special sizes, edited as an aligned 2-column (size | amount) table and stored
  as JSON (`car_models.oring_usage`). The settings row shows an era chip + a "has notes" dot.
- Settings page is master–detail with an inline expand: a model row expands to `ModelInfoView`
  (read-only) → `Edit` → `ModelInfoEditor` (Save/Cancel). "Spine" grouping makes the open editor
  visually belong to its model.

## Conventions to keep

- Money in satang; render with `baht()`. Dates with `formatUpdatedAt`.
- New non-submit buttons get `type="button"`.
- Verify UI changes live against the deployed API (preview server fetches `api.homeseeker.me`); show
  proof (measurements/screenshot). Pure helpers (`format.ts`, pricing) are TDD.
- Keep the campaign workspace client-only — it must never POST.

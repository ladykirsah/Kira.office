---
type: feature
title: Barcode & labels — owner-locked artwork, add-form flow, paper packing
description: Label page (PRs #77/#78/#79) with owner-locked 2×2 artwork (Full·Minimal × L/S), per-label size, proportional-shrink A4 packing; two open items remain
tags: [barcodes, labels, printing, pdf, admin]
timestamp: 2026-10-31
status: live
sources: [kira-barcode-labels-flow-redesign.md, apps/admin/src/lib/labelForm.ts, apps/admin/src/lib/labelGrid.ts, apps/mobile/src/lib/barcodeLabel.ts, apps/mobile/src/lib/labelSheet.ts]
---

# Barcode & labels

## NEWEST — ออกบาร์โค้ด in the Expo app (2026-10-31), a new label that replaces the July artwork there

The owner drew a new, tall label from their own picture and approved it (design canvas v219). The Expo
page `/barcodes` (menu name **ออกบาร์โค้ด**) prints only this label; the July Full·Minimal artwork below
stays on the old back office's computer page.

- **Label:** product type in Thai over the brand in English, product code in grey, a hairline, up to 5
  car lines (Thai model name bold + years), the product code's QR, then the shop name + phone in grey.
  Everything Thai except the brand. A car model with no Thai name prints its saved (English) name.
- **Sizes by width:** S = 35 mm, L = 46 mm. The height follows the picture's shape and shrinks with
  fewer car lines (S 46.5 mm and L 61.1 mm at 5 lines). Every position comes from the owner's picture,
  measured in px of a 413 × 549 picture: `PICTURE` in apps/mobile/src/lib/barcodeLabel.ts (tested).
- **Paper:** A4 or A5, upright or sideways, 8 mm margin; one size per column, labels stacked with no
  gap, the same product kept together (`planLabelPages`, apps/mobile/src/lib/labelSheet.ts, tested).
- **Files:** PDF (one page per sheet at the paper's exact size) or PNG (one picture per page), plus
  one label as a PNG from its own sheet. The browser draws the pages off screen and html2canvas +
  jsPDF turn them into files (`ui/barcodes/saveSheet.web.ts`). The hidden pages must stay on screen
  until the file is made. Label text is never clipped at its own box, because the canvas draws the
  system font slightly wider than the page does.
- **Shop phone:** a new `phone` shop field (`shop:<profile>:phone`), set in ข้อมูลร้าน as เบอร์โทรร้าน
  for เด่นแอร์ and printed on every label.

## The artwork is OWNER-LOCKED — reproduce, don't optimise

The owner drew the final design and LOCKED it 2026-07-27 (re-confirmed "lock this design"). The exact px geometry **is** the spec:

- Only **Full · Minimal** versions (NOT "full/general"); only **L = 50 mm / S = 35 mm** heights. Width is NOT an independent number — the whole block scales (aspect Full 2.11:1, Minimal 2.98:1).
- **Full:** header 17 px = Brand(800) · Type(muted 500) | shop "Den Air Service (Surin)" right + 2 px divider 9 px above; name 34 px/1.13/800, clamp 2 lines; bottom pinned: barcode bars 258×52 + "ID \<ref\>" mono 16 px under | fitment 19 px/1.55 muted right, 3 lines; box 620×294, padding 30/34, radius 18, border 2 px #d6dae0.
- **Minimal:** header brand·type ONLY (no shop, no horizontal divider); name (3 lines) | vertical 2 px divider | fitment; box 632×212; NO barcode/ID/shop.
- Palette: ink #16181c, muted #8b9199, line #d6dae0, paper #ffffff.

A suggested width tweak (Full 78 / Minimal 62) was REJECTED — "not approve, exact same scale as reference". Reproduce the owner's drawing faithfully. Also: deliver design mocks as **sent PNG images** — the in-app preview pane and claude.ai artifact links both render blank/unauthed for the owner.

## Shipped across PRs #77 / #78 / #79

- **PR #77** (merged 2026-07-27, commit `310175f`; migration 0065 applied to prod): lib/labelForm.ts (TDD) + LabelStudio reworked into an "Add a label" compose form (Product search → size → Barcode switch → Amount → live preview → Add to sheet). Old search/Sort/Filter/auto-add removed; duplicates blocked (list keyed by product.id).
- **PR #78** (merged + deployed, admin `5d557cd7`): whole page live. `labelForm` = version Full|Minimal × height L/S (`labelDimensions`, `fitmentLines`, `wrapLines`, `buildLabelItem`; 19 tests). labelPdf.ts `drawLabel` draws the locked artwork from the fixed template + one scale. Barcode SWITCH: on = Full, off = Minimal. "On the sheet" TABLE: size is plain text NOT editable — remove and re-add to change; only amount edits. 0-gap tiling. Fitment (brand+model+year) is fetched per product on pick via `getProductDetail(id)` — the product LIST only carries car brands; year ranges print "2012–2018". Products with no barcode CAN be added (Minimal); the switch disables itself. `wrapLines` breaks at spaces (was per-character, breaking "Compressor Asse/mbly"); char-break only for long words + Thai. Header divider was verified by sampling canvas pixels, not by eye.
- **PR #79** (merged + deployed 2026-07-28, admin `5e547a54`): `fitColumns()` in apps/admin/src/lib/labelGrid.ts shrinks a label up to 10% **proportionally** (never stretched — owner explicit) to win a column; `planFittedSheet()` is the single planner for PDF + on-screen count; margin 8 mm. Per A4 portrait: Full·L 97×46 mm = 12/page (was 5); Full·S + Minimal·S keep EXACT size, 16/page; Minimal·L stays 5 — the owner chose S true-size over 27/page at 12.4% shrink. Also: thin light-grey cutting frame per label + save-as-PNG icon per row (`labelFileName` → `label-261470-0290-full-L.png`).

## Owner corrections that overrode the first mock

- Size is **per-label**, not sheet-wide — part box sizes vary; v1's "one size for the whole sheet" was WRONG.
- A barcode is usually unnecessary — boxes already carry the manufacturer's printed ID; most labels just need the title. Title-only = SAME info minus the bars. The add form defaults to "With barcode".
- The flow followed the car-fitment "Add new" pattern (settings/car-fitment/page.tsx `AddFitmentSection`). Owner working style: ask → plan → action, "show me in preview first".

## Open items

- **"On the sheet" row redesign** — the owner rejected all 3 candidates (compact-line / split-card / preview-right; artifact `9ad7ad28-…`).
- **Pre-die-cut sticker sheets** — 0-gap tiling is right for plain paper + guillotine, but die-cut sheets need spacing matching the die-cut. Confirm with the owner before anyone "fixes" the 0-gap.

## References

- [products](products.md) — barcode data comes from product/variant rows
- Design-system rules for admin pages: [conventions](../conventions/index.md)
- Repo doc: docs/BARCODE_AND_INVENTORY.md

# AirPlus wordmark — colour variants

Ten recolours of the `Air+Plus` wordmark, for use across the storefront, LINE OA, invoices, print
and marketplace listings.

All are **1988 × 704 PNG with a transparent background**, generated from
`apps/storefront/public/logo/airplus-logo.png` by using its alpha channel as a stencil — the shapes
and edges are pixel-identical to the original, only the fill colour changed.

## Colours

Taken from the locked DENSO CI palette, **not** from the source file (which is still the retired
coral `#eb5031`):

| | Hex | Name |
|---|---|---|
| Red | `#e10000` | แดงสด — CI primary |
| Black | `#000000` | ดำ |
| White | `#ffffff` | ขาว |
| Blue | `#015abf` | น้ำเงิน — CI highlight, use sparingly |

## The files

Named `airplus-{text}-{plus}.png`; a single colour name means the whole wordmark is that colour.

| File | Text | `+` | Use on |
|---|---|---|---|
| `airplus-red-black.png` | red | black | **The default.** Light backgrounds — this is the CI's red+black pop |
| `airplus-white-red.png` | white | red | Dark backgrounds, and over the red header |
| `airplus-white.png` | white | white | Dark or photographic backgrounds; one-colour print |
| `airplus-black.png` | black | black | One-colour print, faxes, stamps, greyscale documents |
| `airplus-red.png` | red | red | Light backgrounds where a single flat red is wanted |
| `airplus-black-red.png` | black | red | Light backgrounds, quieter than all-red |
| `airplus-white-black.png` | white | black | Mid-tone backgrounds only — the black `+` disappears on a dark one |
| `airplus-black-white.png` | black | white | Mid-tone or light backgrounds — the white `+` disappears on white |
| `airplus-red-white.png` | red | white | Mid-tone backgrounds — the white `+` disappears on white |
| `airplus-red-blue.png` | red | blue | Sparing use only; blue is a CI highlight colour, not a brand colour |

Three of these (`white-black`, `black-white`, `red-white`) contain a colour that vanishes against a
matching background — that is inherent to the combination, not a fault in the file. Check the
background before using them.

## Regenerating

`brand/make-logo-variants.sh <source.png> <output-dir>` — reads the source alpha and refills it.
Needs ImageMagick (`magick`).
The `+` is separated from the text by cutting at x=710 and x=1030, which both fall inside
transparent gaps between glyph groups, so no visible pixel is ever crossed.

## Not included

**Vector (SVG/EPS).** The source is raster only. A printer asking for vector would need the
wordmark redrawn or auto-traced — auto-tracing this would round the corners of the `+` and soften
the italic terminals, so it is better redrawn from the original type than traced.

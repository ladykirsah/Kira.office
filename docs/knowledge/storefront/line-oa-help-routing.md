---
type: convention
title: LINE OA help links & product-vs-service routing
description: The AirPlus LINE OA deep link, where it is wired, the locked product/service LINE routing rule, and the stylized-QR decode recipe
tags: [storefront, line, line-oa, help, links, qr]
timestamp: 2026-08-09
status: live
sources: [airplus-line-oa-wiring.md, den-air-service-public-facts.md]
---

# LINE OA help links & product-vs-service routing

## What it is

The owner's AirPlus LINE Official Account backs every help entry point on the storefront. Taps open LINE directly — the add-friend screen on mobile, LINE's add-friend web page on desktop.

- Deep link: **`https://lin.ee/tltIFtI`** (301 → `line.me/R/ti/p/@811gvdun`, i.e. OA id `@811gvdun`).
- Defined as `LINE_OA_URL` in `apps/storefront/src/lib/links.ts`; used as an external `<a target="_blank" rel="noopener">` by:
  - home shortcut ช่วยหาอะไหล่ (`QuickAccessBar`)
  - PDP sticky-bar ช่วยหาอะไหล่ (`AddToCartBar`)
  - account tile ช่วยเหลือ
  - the home เพิ่มเพื่อน LINE strip
- An intermediate `/line` QR page was built then REMOVED once the deep link existed (redundant — don't rebuild it).

**Not the login.** This OA link is HELP-only. Login uses the separate LINE *Login* channel — see [line-login-and-auth](line-login-and-auth.md).

## LOCKED routing rule (owner-stated 19 Jul 2026, applies to ALL storefront copy)

- **Product/purchase content** → AirPlus OA `https://lin.ee/tltIFtI`
- **Service/booking content** → Den Air's LINE `https://line.me/R/ti/p/@785pvaoi`
- Never mix the two. Business separation: AirPlus sells products ONLY (no installation); Den Air Service is presented as a separate business ("คู่ค้า" in public copy) selling products + services at HIGHER prices than AirPlus web because they cover install-warranty/care — the FAQ states this openly. Full business facts in [business-and-launch](business-and-launch.md).

## Recipe: decoding LINE's stylized QR codes

The deep link was recovered by decoding the OA QR image (`qr-official.line.me/gs/M_811gvdun_GW.png`) with **zbar/pyzbar** — opencv's base `QRCodeDetector` FAILS on LINE's stylized QRs. For future stylized QRs:

```
brew install zbar
pip install pyzbar Pillow
DYLD_FALLBACK_LIBRARY_PATH=$(brew --prefix)/lib python <script>
```

## References

- `apps/storefront/src/lib/links.ts`
- `https://lin.ee/tltIFtI` (AirPlus OA @811gvdun), `https://line.me/R/ti/p/@785pvaoi` (Den Air)

---
type: plan
title: AirPlus business facts & launch decisions
description: Confirmed business facts, the Den Air separation and แท้ taxonomy, brand-naming numerology, and the locked lowest-cost launch verdicts
tags: [storefront, business, launch, decisions, brand, thai, den-air, numerology]
timestamp: 2026-08-09
status: convention
sources: [airplus-policy-docs-2026-07.md, den-air-service-public-facts.md, thai-numerology-auspicious-totals.md, airplus-launch-cost-decisions-2026-07.md, airplus-launch-plan-lockstep.md]
---

# AirPlus business facts & launch decisions

## Confirmed business facts (owner-confirmed, not guessed)

- Address: 88 หมู่ 7 ต.กังแอน ถ.สุรินทร์-ช่องจอม อ.ปราสาท จ.สุรินทร์ 32140
- Contact: air.plus.seller@gmail.com · 044-551-991 / 061-939-6144 · LINE OA @811gvdun
- **AirPlus is B2C-only, products-only (no services)** — separate from the on-site Den Air Service workshop, though both are the same legal entity (บริษัท เด่นแอร์ เซอร์วิส จำกัด / Den Air Service Co., Ltd.) and share the Kira.office back office. Website = AirPlus (brand); Den Air Service = legal entity/on-site; cross-linked in the footer for trust.
- The docs' placeholder domain `www.airplusshop.xxx` was later replaced by airplusauto.com.

## Den Air Service public facts (for storefront copy)

- Services: ล้างตู้แอร์ / ตรวจเช็ค / เติมน้ำยา / งานซ่อม at the storefront; every vehicle with AC — รถบ้าน รถสิบล้อ แม็คโคร รถตัก รถเกรด รถเจาะ — EXCEPT รถบัส/รถทัวร์ (buses/coaches).
- Official Hi-Kool dealer installing ฟิล์มกรองแสงกันความร้อน (heat-blocking film); technicians DENSO-trained yearly.
- Work warranty depends on job type; NO warranty if the customer insists against advice — explained before work.
- Google Maps https://maps.app.goo.gl/KG92McioZ8amZjoS6 · โทร 063 926 1445 · เปิด 09:00–17:00 (**opening DAYS still unconfirmed** — also flagged in `business.ts`, see [seo-and-agent-discovery](seo-and-agent-discovery.md)).
- Den Air prices are HIGHER than AirPlus web because they cover install-warranty/care; the FAQ says this openly. LINE routing between the two businesses is LOCKED — see [line-oa-help-routing](line-oa-help-routing.md).

### The owner's แท้ ("genuine") taxonomy — use this exact public wording

- **แท้ศูนย์** = เบิกศูนย์รถยนต์ (from the car maker's dealer network)
- **แท้แบรนด์** = a brand makes/sells its own part (e.g. DENSO แท้, Cool Gear แท้, Formula แท้) = what AirPlus sells. Formula is a real product brand.
- Trade meaning of **ของเทียบ** = every brand that is not เบิกศูนย์
- **แท้ติดรถ** = same brand as the factory-installed part

## Brand naming: Thai เลขศาสตร์ numerology (convention for any future naming)

Every candidate brand/website name's letter-sum must total one of: 04 05 06 09 · 14 15 19 · 23 24 · 32 36 40 · 41 42 44 45 46 50 · 51 54 55 56 59 60 · 63 64 65 · 89 90 · 91 95 98 99. Gender exceptions: 19/91 not good for female, 23/32 not good for male — the brand persona is "ลูกสาวร้านแอร์" (female), so treat 19 and 91 as excluded.

- **HARD RULE: avoid 7** — no name may total 7 and no name may contain a value-7 character: English O, Z; Thai ศ ส ซ and vowel ◌ี (sara ii) — which killed "เลดี้/lady"-style names.
- English values = standard Chaldean numerology (A/I/J/Q/Y=1, B/K/R=2, C/G/L/S=3, D/M/T=4, E/H/N/X=5, U/V/W=6, O/Z=7, F/P=8, 9 unassigned).
- Thai values confirmed by the owner: า=1, แ=2, ◌ู=2, ◌ี=7(avoid), ่=1, ้=2, ์=9, ค=4, ร=4, น=5, ล=6, ก=1, อ=6. The rest of the chart needs transcription before a full generator can be built.
- **CHOSEN: AirPlus / แอร์พลัส (EN total 24, TH total 42, both auspicious)** — the owner knowingly accepted that พลัส contains ส=7, choosing good totals + a readable name over the strict letter rule.
- Brand assets: TikTok "ลูกสาวร้านแอร์" / handle car.ac.lady; Shopee "Car AC on Sales"; Kira.office = the internal admin back office.
- Business context: moving car-AC parts off Shopee (30% commission made SKUs like the DENSO Vigo evaporator lose money) to a direct site aimed at mechanics, funneled via TikTok + the FB group "กลุ่มช่างแอร์รถยนต์แห่งประเทศไทย" (41.7K members). The quantified vs-Shopee case lives in [commerce](../commerce/index.md).

## Lowest-cost launch verdicts (2026-07-18)

- **OTP SMS CUT** (was ฿1,500/yr prepaid minimum): replaced with FREE web LINE Login (a LINE Developers Login channel — NOT the paid/verified OA, NOT the full mini app); phone collected once at registration (LINE doesn't provide one). The ThaiBulkSMS OTP seam (`apps/storefront/src/lib/sms.ts`) stays DORMANT behind its flag — see [line-login-and-auth](line-login-and-auth.md).
- **COD enabled** ("COD too") + PromptPay (฿0 fee): Flash COD ≈3% of the collected amount = the owner's cost, absorbed into margin (no customer surcharge unless the owner asks); needs a free Flash COD merchant registration (no deposit). COD is already modeled as `payment_status = เก็บเงินปลายทาง` — see [commerce](../commerce/index.md).
- **CUT** the ฿15,000 shipping deposit (dead float).
- **DEFER** the LINE OA paid plan ฿800/mo until it can drive ≥3 orders/mo (฿800 ÷ ~฿268 saved/order yardstick).
- **KEEP** the domain ~฿29/mo and Claude ฿2,700/mo through launch as a build investment; ongoing AirPlus cost ≈ domain + ~free Cloudflare.
- **Acquisition at launch**: don't pay for discoverability at a near-zero base — convert EXISTING Shopee buyers (big-ticket first). Moving just the 4 biggest July orders keeps ฿3,407 in fees (4× the ฿800/mo LINE plan) at ฿0 acquisition cost.
- These verdicts SUPERSEDE the earlier Shippop-from-launch plan and SMS-OTP-at-launch.

## LOCKED launch decisions (2026-07-17 — do not relitigate)

1. **Hide /coupons + /account/coupons at launch** — the 6 advertised codes are a hardcoded mock and ALL fail at checkout; real codes created in admin still work when typed at checkout; a member-scoped wallet is post-launch. (The mock is still a live trap — see [commerce](../commerce/index.md).)
2. **Real shipping rates from launch; NO free-shipping promotion** — remove the ส่งฟรี ribbons + "ฟรี (ช่วงเปิดร้าน)" copy; the owner self-serves a free-over-฿X promo in admin later. (Originally Shippop-based; updated 2026-07-18 to the Flash local rate-card approach — see [commerce](../commerce/index.md) for shipping-fee mechanics.)
3. From the same session: commit `4b3360b` added storefront + admin to `npm run typecheck` — CI previously checked neither and would have shipped 10 null-safety errors the same day (see [operations](../operations/index.md)).

## References

- `apps/storefront/src/lib/sms.ts`, `src/lib/business.ts`
- commit `4b3360b`

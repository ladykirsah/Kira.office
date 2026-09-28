---
type: reference
title: Part code logic — how every product gets its code
description: Three-step rule for product codes (real number → pack/defect of a coded part → own code PART-MAKE-MODEL); letter tables; the 68 codes created 2026-09-27
tags: [codes, sku, catalog, shopee]
timestamp: 2026-09-27
status: live
sources: [Google Sheet "อ่ะไหล่รถ On Sales" tab "🎟️ ราคาใหม่" column I (Code)]
---

# Part code logic

Approved by L on 2026-09-27. Every product has one code. The code lives in the **Code** column (I)
of the Google Sheet "อ่ะไหล่รถ On Sales", tab "🎟️ ราคาใหม่". The sheet is the source of truth.

The same code is the **SKU on Shopee**:

- A listing with several options: each option's SKU is its code.
- A listing with one product: the **Parent SKU** is the code.

## The rule: three steps, stop at the first that fits

**Step 1: real number first.**
If the box, catalogue or Shopee description has a maker or supplier number, use it exactly.

**Step 2: same part, other pack or a defect copy.**
Take the coded part and add a suffix:

- A different pack size: `-1P`, `-2P`, `-3P`… (e.g. `CL-SPC-3P`, a 3-pack of `CL-SPC`).
- A `###` defect copy: `-DF` (e.g. `UHD006-DF`).

Careful: some supplier codes already end in `-2P` and mean something else. In the dryer supplier's
`JPDF-38-2P`, `2P` means 2 pressure-switch ports, not a 2-pack. Never add a pack suffix that would
make a code look like a different supplier part.

**Step 3: no number anywhere, so build an own code.**
Read it left to right as part, then car make, then model + year:

```
RS  -  HD  -  CTY09
part   make   model + 2-digit year
```

This is the resistor for a Honda City 2009.

- Parts that fit any car use `UN` as the make: `DR-UN-BAG23`, `PS-UN-2PIN`.
- Supplies sold by brand or size put that after the part: `RF-ICB-13KG` (Iceberg 13 kg),
  `CO-SP10-250` (SP10 oil 250 cc), `FU-MINI-10A` (mini fuse 10 A).

Add extra detail at the end **only when it is needed** to tell two rows apart:

| Detail | Example |
| --- | --- |
| Size | `AP-6X34`, `FO-15X100` |
| Volts / pins | `RL-BSH-24V`, `RL-IS-DMX-4PIN` |
| Grade | `-PR` premium (อย่างดี), `-AV` average (ธรรมดา) |
| Pack | `-3P`, `-5P`, `-10P` |
| Brand, when the real number is not known yet | `-D` DENSO, `-F` Formula, `-C` Cool Gear |

**Hard rules**

- Use only letters, numbers and `-`. No Thai and no spaces.
- A code is 15 characters at most.
- A code is never reused, not even after a product is removed.

## Letter tables

**Part**

| Code | Part |
| --- | --- |
| EV | คอยล์เย็น, evaporator |
| RS | รีซิสแตนท์, resistor |
| PS | pressure switch |
| DR | dryer |
| EX | expansion valve |
| CD | condenser |
| RD | radiator |
| CO | compressor oil |
| RF | refrigerant |
| CL | cleaner |
| OR | O-ring |
| RL | relay |
| FU | fuse |
| VC | valve core |
| TP | tape |
| FO | foam strip |
| AP | air pipe |

**Car make** (these are the same letters John Chuan already uses)

| Code | Make |
| --- | --- |
| TY | Toyota |
| HD | Honda |
| IS | Isuzu |
| NS | Nissan |
| MS | Mitsubishi |
| FD | Ford |
| MD | Mazda |
| CV | Chevrolet |
| SZ | Suzuki |
| HN | Hino |
| FS | Fuso |
| KB | Kobelco |
| UN | fits any car |

**Model** (three letters, then a 2-digit year when the sheet gives one)

| Code | Model |
| --- | --- |
| VGO | Vigo |
| RVO | Revo |
| MTX | Mighty-X |
| VOS | Vios |
| CTY | City |
| CVC | Civic |
| BRO | Brio |
| DMX | D-Max |
| NVR | Navara |
| TRT | Triton |
| RGR | Ranger |
| MEG | Mega |
| MK8 | Mark 8 |

Add a new letter code to these tables the first time it is used.

## How the brands already build their codes

| Brand | Example | How it is built |
| --- | --- | --- |
| DENSO | `TG116340-18704D` | Maker part number, ends in 4D |
| Cool Gear | `DI446610-18604W` | DENSO numbering, ends in 4W |
| Formula | `9700-0206-00` | Maker number, 4-4-2 digits |
| Vinn | `BW-HD-004`, `UHD006` | Part + car make + running number |
| John Chuan | `TY-B5102A` | Car make + part letter + number |
| Dryer supplier | `JPD-IS-DMX12`, `JPDF-38-2P` | Part + make + model + year; `-2P` = 2 pressure-switch ports, not a pack |

## Special cases

- **Merged Code cells.** Rows 216, 285, 448, 450, 452 and 485 have their Code cell merged with the
  row above, so they share that row's code on purpose. Leave them as they are.
- **R12 O-rings** keep the supplier codes exactly as printed: `ND/R12#1` to `ND/R12#4`.
  They break the "letters, numbers and `-` only" rule, because step 1 (the real number) comes first.
  The size order is assumed: #1 = 5/16, #2 = 3/8, #3 = 1/2, #4 = 5/8.
- **Branded rows with a fallback code.** Six rows had no maker number anywhere, so they carry a fallback
  code ending in the brand letter. If the real number is found on the box, replace the fallback with it.

| Row | Product | Fallback code |
| --- | --- | --- |
| 77 | Formula คอยล์เย็น, Honda Brio 2014 | `EV-HD-BRO14-F` |
| 86 | Formula คอยล์เย็น, Isuzu D-Max 2006 | `EV-IS-DMX06-F` |
| 142 | Formula คอยล์เย็น, Fuso Euro-3 | `EV-FS-E3-F` |
| 200 | DENSO pressure switch, Hino Mega | `PS-HN-MEG-D` |
| 246 | Cool Gear expansion valve, หลอด | `EX-UN-TUBE-C` |
| 264 | DENSO condenser, Toyota Vios 2007 | `CD-TY-VOS07-D` |

## Codes created on 2026-09-27

On this date, 68 blank Code cells on the sheet were filled and then checked against the sheet.
The row numbers are sheet rows.

| Category | Row → code |
| --- | --- |
| คอยล์เย็น | 77 `EV-HD-BRO14-F` · 86 `EV-IS-DMX06-F` · 113 `STE-1021C` (supplier number) · 142 `EV-FS-E3-F` |
| รีซิสแตนท์ | 188 `RS-TY-MTX` · 189 `RS-HD-CTY09` · 190 `RS-IS-DMX` · 191 `RS-NS-NVR` · 192 `RS-FD-RGR12` |
| Pressure Switch | 195 `PS-TY-VGO` · 198 `PS-HD-CVC` · 199 `PS-IS-DMX` · 200 `PS-HN-MEG-D` · 202 `PS-UN-2PIN` |
| Dryer | 205 `DR-HD-CTY14` · 211 `DR-KB-MK8` · 217 `DR-UN-BAG23` · 218 `DR-UN-BAG30` · 221 `DR-UN-M16` |
| Expansion Valve | 246 `EX-UN-TUBE-C` |
| Condenser | 264 `CD-TY-VOS07-D` |
| Radiator | 374 `RD-TY-VGO` · 376 `RD-TY-RVO` · 384 `RD-IS-DMX03` · 386 `RD-IS-DMX12` |
| Compressor Oil | 433 `CO-SP10-250` · 434 `CO-SP20-250` |
| Liquids | 440 `RF-ICB-13KG` · 441 `RF-ICB-3KG` · 442 `CL-SPC` · 443 `CL-SPC-3P` · 444 `CL-HSP` · 445 `CL-HSP-3P` |
| O-Ring | 453–456 `ND/R12#1`–`#4` · 457–466 `OR-IS-DMX1-PR`, `OR-IS-DMX1-AV` … `OR-IS-DMX5-PR`, `OR-IS-DMX5-AV` · 467–469 `OR-FD-1`, `OR-FD-2`, `OR-FD-3` |
| Relay / Fuse | 476 `RL-IS-DMX-4PIN` · 477 `RL-BSH-12V` · 478 `RL-BSH-24V` · 479–483 `FU-MINI-10A`, `-15A`, `-20A`, `-25A`, `-30A` |
| Valve core | 486 `VC-134-CAP` · 487 `VC-134-SET` |
| Tape / Foam / Air pipe | 489 `TP-3M-ELEC` · 490–493 `FO-15X100`, `-3P`, `-5P`, `-10P` · 494–496 `AP-6X34`, `-3P`, `-5P` |

These new codes are on the sheet only. Each one goes onto Shopee as the SKU when its category is repriced.

## References

- [shopee-integration-strategy](shopee-integration-strategy.md): the plan that the Shopee SKU = the product code, so an order line matches exactly one product.

---
type: feature
title: งานซ่อม — the repair job (server side)
description: Job steps with backward moves and who/when history, the estimate → job bill → paid bill, parts held in งานนอก until paid (owner's pick A), waiting parts with date and time, new parts linked later, cancel with a reason
tags: [repair-job, pos, stock, hold, bill, line-oa]
timestamp: 2026-11-17
status: built (server only; screens come with the design kit)
sources: [owner messages 17 Nov 2026, plan 10.1]
---

# งานซ่อม — the repair job

Plan 10.1 (owner, 17 Nov 2026). Server and database only; the screens come later.

## Steps

`in` เข้าใหม่ → `check` ตรวจเช็ค → `estimate` ประเมินราคา → `agreed` ลูกค้าตกลงราคา → the work
(`waiting_parts` รออะไหล่ while any part is missing, else `working` กำลังซ่อม) → `ready`
พร้อมรับรถ (the bill is issued to pay) → `paid` ชำระเงินแล้ว. Plus `cancelled` with a reason.

- Forward is **one step at a time**; **back to any earlier step** (owner: "backward = yes").
- รออะไหล่ is never picked by hand: a missing part puts the job there, the last one in takes it out.
- Paid and cancelled are closed. A job is never deleted.
- Every move is kept in `repair_job_events` with who and when.
- The steps that send the customer a LINE OA update (`in`, `check`, `waiting_parts`, `working`,
  `ready`) are recorded on the event as `customer_update`; sending them comes with the later "send
  to car owner" feature. รออะไหล่ carries the time of the last part still waiting (date AND time —
  the one exception to the no-clock-time rule).
- Rules: `packages/core/src/repairJob.ts`. Database: migration 0105. Server:
  `apps/api/src/repairJobs.ts`, every write through the StockLedger Durable Object.

## Lines and stock (owner's pick A)

- Lines added before the work are the **price estimate** only (`estimate`) — no stock moves.
- Starting the work (agreed → working) puts the estimate on the job's bill: a part in stock moves
  ขายได้ → **งานนอก** (`hold`, source `repair_job`); a missing part waits. Labour goes straight on.
- Mixed parts (A in stock, B waiting, C in stock): the team starts with A and C; the job shows
  รออะไหล่ until B is in.
- A waiting part is either an existing product that ran out (staff scan › fill) or a brand-new
  part typed by name (staff add it with เพิ่มสินค้า, fill stock, then link it to the job line).
- Ending the wait (รออะไหล่ → working) takes every waiting part into งานนอก — or refuses and names
  each part still missing (`not_in_stock` / `not_linked`), changing nothing.
- พร้อมรับรถ needs every line on the bill; lines are locked until the job goes back to working.
- **Paid:** one write makes the paid bill (`onsite_sales`, `sale_type 'repair'`, the job's number),
  priced by the same cost/VAT code as the counter (`priceBillLines`), and sells the parts out of
  งานนอก (`unhold` + `onsite_sale`). A part someone put back on the shelf by hand is sold from
  ขายได้ instead. Money counts only from here — the bill row doesn't exist before payment.
- **Removed line / cancel:** taken parts go back to ขายได้; the lines are kept as `removed`.

## Numbers

Job number `JByyyymm-ddnnn`, made by the server by the Thai date. The job's bill carries the same
number, so it can never clash with a phone's `DAS…` walk-in bill.

## Addresses

`GET /repair-jobs` (filters `status`, `plate`, `mechanic`, `open=1`; counts per step) ·
`GET /repair-jobs/:id` · `POST /repair-jobs` · `POST /repair-jobs/:id/status {to}` ·
`POST /repair-jobs/:id/lines` · `PATCH|DELETE /repair-jobs/:id/lines/:lineId` ·
`PUT /repair-jobs/:id/mechanics {userIds}` · `POST /repair-jobs/:id/cancel {reason}` ·
`POST /repair-jobs/:id/pay {paymentMethod: cash|promptpay}`. Every role may use them (a ช่าง moves
jobs and takes payment, like at the counter).

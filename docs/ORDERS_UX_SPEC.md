# Orders UX spec — learned from Shopee Seller Centre

Reference: five Shopee Seller Centre screens supplied by the owner, 30 Jul 2026 (order list ·
cancel/refund/return list · order detail ×3). Shopee is the **reference for shape, not for
workflow** — the owner's instruction was "our work flow may not the same with Shopee". Every
divergence below is deliberate.

Shopee is also a **separate channel** from AirPlus (owner, 30 Jul): the `/orders` page is
AirPlus-only. This document borrows Shopee's interaction patterns; it does not describe importing or
managing Shopee orders, which live on `/sales`.

---

## 1. Patterns worth adopting

### 1.1 The action column is status-specific, not a fixed menu

Shopee does not render one generic "Actions" control per row. It renders **the action that status
actually needs**, as a plain link:

| Shopee status | Action shown |
| --- | --- |
| สำเร็จ (completed) | `ให้คะแนน` — rate the buyer |
| Return, goods received | `ได้รับสินค้าคืนในสภาพดี` **and** `เคลมสินค้าสูญหาย/เสียหาย` |

Two things follow: a row can carry **more than one** action, and an action can be **absent** when
the status needs nothing. The current implementation (one dropdown, always "View") is the
placeholder this replaces.

### 1.2 "What needs doing" filter chips, with counts

The returns screen filters by *pending operator action*, not by status:

`ตอบกลับผู้ซื้อ` · `อัปโหลดหลักฐาน` · `ยกเลิกการจัดส่ง (1)` · `ตรวจสอบสินค้าคืน (1)` ·
`ดูคำขอที่ Shopee อนุมัติ` · `เคลมค่าจัดส่ง`

The counts are the point — the operator sees where work is waiting before opening anything. This is
the right model for our **Unfinished** tab, which currently lumps five unrelated states together.

### 1.3 Deadline priority as a filter

`ลำดับความสำคัญ: ทั้งหมด · หมดเวลาในอีก 1 วัน · หมดเวลาในอีก 2 วัน`, and the list's status column is
headed `สถานะ | นับถอยหลัง` — status **and** countdown share the column.

We have a real deadline of our own: the 48h unpaid auto-expire. The owner removed the per-row
countdown, so this is recorded as available, not scheduled.

### 1.4 Order card grouping

Each Shopee row is a card: a header strip carrying buyer + order number, with the line items inside
it. Ours is a flat table row. Only worth revisiting if we show line items in the list — the owner has
said the list is **summary info for a quick look only**.

---

## 2. Detail page anatomy (`/orders/:id`)

Shopee's layout, left column top to bottom, with our intended content:

| # | Section | Shopee | Ours |
| --- | --- | --- | --- |
| 1 | Status banner | สำเร็จ + rating state | order status + payment status + expiry countdown when unpaid |
| 2 | Note | `เพิ่มบันทึก` top-right | same — internal staff note |
| 3 | Order number | plain text | + channel badge |
| 4 | Shipping address | **masked** (`น*****ᐟ`) | unmasked — our own customer, not a marketplace intermediary |
| 5 | Shipping info | parcel no., carrier, tracking chip, recipient + phone, parcel timeline | same |
| 6 | Buyer | avatar, name, follow/chat | **replaced** — see §3.1 |
| 7 | Items | image, name, variant, SKU, unit price, qty, net | same |
| 8 | Money | marketplace fee ladder | **replaced** — two books, see §3.2 |
| 9 | Adjustments | transfer adjustments + empty state | not applicable (no escrow) |
| 10 | Net / buyer paid | `ยอดเงินสุทธิ` / `การชำระเงินของผู้ซื้อ` | grand total + how they paid |

**Right rail: status timeline, newest first**, each entry an icon + title + one-line explanation +
timestamp. Shopee's example:

```
✅ การโอนเงินสำเร็จแล้ว   ทำการโอนเงินไปยังบัญชีของคุณแล้ว   14/07/2026 14:37
✔  สำเร็จ                                                  14/07/2026 14:37
💲 ผู้ซื้อยืนยันการรับสินค้าแล้ว  …จะดำเนินการโอนเงิน…        14/07/2026 14:37
📄 คำสั่งซื้อใหม่                                            07/07/2026 00:13
```

This is worth copying wholesale — it answers "what happened to this order" without reading the page.
It needs a status-history table we do **not** have yet (see §5).

---

## 3. Where our workflow diverges

### 3.1 We have a customer credit system; Shopee has none

Shopee's buyer block is a name, a follow button and a chat button, because the marketplace owns the
relationship. We own ours, so section 6 becomes a **customer block**: tier badge
(`best/good/watch/bad/block`), credit score, COD eligibility, and lifetime order count — the inputs
that decide whether this customer gets COD at all.

Consequence for the list: Shopee's completed-order action is `ให้คะแนน` (rate the buyer). We do not
rate buyers manually — `delivered` already feeds `creditEventFromOrder` automatically. So **our
completed rows need no action**, and that column should be empty rather than invent one.

### 3.2 Our money block has no marketplace fees — and it is two books, not one ladder

Shopee's ladder is commission, payment transaction fee, escrow ad top-up, shipping subsidy. None
apply.

**Superseded 30 Jul 2026.** This section previously specified a single ladder — subtotal → coupon
discount → shipping fee → grand total, then cost and profit — and that is what shipped first. The
owner rejected it, for a reason worth recording: their profit formula described *what we receive*,
while the line was labelled **Total**, which everyone reads as *what the customer was charged*. One
word, two different numbers.

The block is now two panels:

| What the customer was charged | What we kept |
|---|---|
| Subtotal | Goods after discount |
| − Coupon discount | − Item cost |
| + Shipping | − Shipping on us |
| **= Customer paid** | **= Profit** |

Two rules hold this together, and breaking either one moves a number the owner reads daily:

1. **Shipping is not counted twice, and the pairings must not be swapped.** A base that already
   contains the customer's fee (Customer paid) must deduct the carrier's **full** charge. A base that
   excludes it (Goods after discount) must deduct only the **shortfall** — real charge minus what the
   customer paid. Both reach the same profit; mixing them is wrong by exactly the fee. The right-hand
   panel uses the second pairing, so the customer's pass-through stays out of our margin entirely.
2. **Profit is derived, never read from `profit_satang`.** That column is written once at checkout and
   deliberately excludes shipping, so it is stale from the moment a parcel is dropped off. The
   derivation lives in `orderMoney` in `packages/core`, which both `/orders` and `/orders/:id` read, so
   the two pages cannot disagree.

A shipping panel sits below with the owner's four figures — auto calculated, offered to customer (only
on shared-fee orders), charged to customer, on us — plus the **real charge**, without which "on us" has
no arithmetic behind it. Migration 0073 adds the three columns; `carrier` and `tracking_no` already
existed from 0030.

### 3.3 COD approval is ours alone

Shopee has no analogue: `เก็บเงินปลายทาง` is simply a payment method there. For us it is a
**decision** gated on tier (`codApproval(tier)` → `auto | staff | blocked`), and the orders page
already surfaces it as a summary card. `cod` + `new` therefore needs Approve / Deny actions that have
no Shopee counterpart.

### 3.4 Returns need a mechanic, not a warehouse check

Shopee's closest action is `ตรวจสอบสินค้าคืน` (inspect returned goods) — a warehouse condition
check. Ours requires a **named mechanic's sign-off** that the part actually failed, before any refund
moves. That is an extra state Shopee's flow does not have, and it is why returns are Step 6 rather
than a variation on cancel.

### 3.5 48h auto-expire is ours

Shopee's `ยังไม่ชำระ` waits on Shopee's own payment window. Ours expires at 48h, writes
`expired`/`expired`, and costs the customer credit. That is a state transition with a money and
reputation consequence, not just a filter.

---

## 4. Action model — DECIDED (owner, 30 Jul 2026)

**We do not copy §1.1.** The row keeps a single `Actions` dropdown containing **only `View`**.

Per-status operations do **not** become row actions. They get their own dedicated pages, because each
one is a decision with its own context and approval trail rather than a one-click state flip:

- **COD confirm** — its own page. Needs the customer's tier, credit score and history visible at the
  moment of deciding; `codApproval(tier)` says whether it is even the operator's call.
- **Mechanic return approval** — its own page. Needs a named mechanic's verdict on whether the part
  actually failed before any money moves.

This keeps the list what the owner asked it to be — summary information for a quick look — and keeps
irreversible, money-moving decisions off a dropdown in a table row. The matrix in §1.1 stays in this
document only as a record of how Shopee does it, not as our plan.

---

## 5. Build order — DECIDED (owner, 30 Jul 2026)

**Status history table first, then the detail page.** The timeline is only worth building against a
real history; deriving it from the four timestamps we happen to store would fake it.

## 6. What `audit_logs` already gives us (and what it does not)

Checked before proposing a new table. `audit_logs` (migration 0016) already exists, and the API has a
global wrapper that writes a row for **every non-GET request** with the real Cloudflare Access email,
and `entityFromPath` already maps `/orders/:id` → `("order", <id>)`.

So the actor plumbing is done. What it cannot do today:

| Gap | Why |
| --- | --- |
| No status values recorded | `writeAuditLog` hardcodes `before_json` to `NULL`, and the PATCH `/orders/:id` route passes no `detail`, so `after_json` is `NULL` too. A row proves *someone PATCHed this order*, not what changed. |
| Storefront transitions invisible | Checkout and the slip route are **Next.js routes writing straight to D1**, bypassing the API wrapper. "Order created" and "paid by slip" produce no audit row at all. |
| Auto-expire invisible | `expireUnpaidOrders` runs inside `listOrders`, a **GET** — the wrapper only audits non-GET. |
| Wrong shape for a timeline | It is a general mutation log. A carrier or tracking edit produces a row with no status change, so a timeline would have to filter noise and parse JSON per row on a path read every time an order is opened. |

Conclusion: keep `audit_logs` as the compliance record, add a purpose-built history table for the
timeline, and reuse the existing Access-email actor rather than inventing a second identity.

## 7. Known gaps still open

1. **`/orders/:id` does not exist.** The list's `View` currently links to a 404.
2. **No staff identity.** COD approval and mechanic sign-off must record *who*. The Access email
   covers it for now; real per-staff roles are the Staff & Mechanic plan.
3. **No internal note field** on `sales_orders` for §2 item 2.
4. **No return/claim state** in the status enum yet — returns are Step 6.

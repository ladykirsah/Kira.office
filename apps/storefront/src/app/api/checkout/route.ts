import type { D1Database } from "@cloudflare/workers-types";
import {
  couponDiscountSatang,
  defaultPaymentMethod,
  FLASH_TH_RATE_CARD,
  FLASH_TH_REMOTE_POSTCODES,
  isRemotePostcode,
  parsePaymentMethods,
  quoteShippingSatang,
  resolveEffectivePrice,
  shopKey,
  validateCoupon,
  type PaymentStatus,
} from "@l-shopee/core";
import { getSession, guardMutation } from "@/lib/auth";
import {
  IDEMPOTENCY_REF_PATTERN,
  couponReasonThai,
  type CheckoutAddress,
  type CheckoutPaymentMethod,
  type CheckoutSuccess,
} from "@/lib/checkoutApi";
import { getCheckoutPricing, getCouponWithUsage, getDb, getEnv } from "@/lib/db";

/**
 * POST /api/checkout v2 — logged-in checkout: the session cookie is the ONLY source of customer
 * identity (never the body). Keeps every v1 guarantee: guardMutation first, idempotency-first
 * replay keyed on the client ref, server-side re-pricing (now campaign-aware via
 * resolveEffectivePrice), fail-closed stock check, ONE atomic D1 batch, stock deduction through
 * the shared StockLedger DO afterwards. New in v2: address book (saved id OR new address),
 * one-time name capture, coupon redemption, and guarded flash-sale stock caps.
 */

const GENERIC_ERROR = "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง";

function trimmed(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

interface ParsedCheckout {
  idempotencyRef: string;
  name: string | null;
  addressId: string | null;
  address: CheckoutAddress | null;
  paymentMethod: CheckoutPaymentMethod;
  couponCode: string | null;
  /** deduped by variantId (qty summed) so per-variant stock/cap checks can't be split-bypassed.
   *  expectedPriceSatang = the price the customer saw (used only to refuse a silent overcharge). */
  lines: { variantId: string; qty: number; expectedPriceSatang?: number }[];
}

/** Validate the raw JSON body → a normalized ParsedCheckout, or a Thai error string. */
function parseBody(raw: unknown): ParsedCheckout | string {
  if (typeof raw !== "object" || raw === null) return "คำขอไม่ถูกต้อง";
  const b = raw as Record<string, unknown>;

  const ref = typeof b.idempotencyRef === "string" ? b.idempotencyRef : "";
  if (!IDEMPOTENCY_REF_PATTERN.test(ref))
    return "รหัสอ้างอิงคำสั่งซื้อไม่ถูกต้อง กรุณาโหลดหน้าชำระเงินใหม่";

  const name = trimmed(b.name);
  const couponCode = trimmed(b.couponCode);

  // Address: EITHER a saved-address id OR a full new address (validated like v1).
  const addressId = trimmed(b.addressId);
  let address: CheckoutAddress | null = null;
  if (!addressId) {
    const addr = (b.address ?? {}) as Record<string, unknown>;
    const recipientName = trimmed(addr.recipientName);
    const addrPhone = trimmed(addr.phone);
    const addressLine1 = trimmed(addr.addressLine1);
    const subdistrict = trimmed(addr.subdistrict);
    const district = trimmed(addr.district);
    const province = trimmed(addr.province);
    const postalCode = typeof addr.postalCode === "string" ? addr.postalCode.trim() : "";
    if (!recipientName || !addrPhone || !addressLine1 || !subdistrict || !district || !province)
      return "กรุณากรอกที่อยู่จัดส่งให้ครบทุกช่อง";
    if (!/^\d{5}$/.test(postalCode)) return "กรุณากรอกรหัสไปรษณีย์ 5 หลัก";
    address = {
      recipientName,
      phone: addrPhone,
      addressLine1,
      subdistrict,
      district,
      province,
      postalCode,
    };
  }

  const paymentMethod = b.paymentMethod;
  if (paymentMethod !== "promptpay" && paymentMethod !== "transfer" && paymentMethod !== "cod")
    return "กรุณาเลือกวิธีชำระเงิน";

  const rawLines = b.lines;
  if (!Array.isArray(rawLines) || rawLines.length < 1 || rawLines.length > 20)
    return "รายการสินค้าต้องมี 1-20 รายการ";
  const qtyByVariant = new Map<string, number>();
  const expectedByVariant = new Map<string, number>();
  for (const entry of rawLines) {
    const line = (entry ?? {}) as Record<string, unknown>;
    const variantId = trimmed(line.variantId);
    const qty = line.qty;
    if (!variantId || typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > 99)
      return "จำนวนสินค้าไม่ถูกต้อง (1-99 ชิ้นต่อรายการ)";
    qtyByVariant.set(variantId, (qtyByVariant.get(variantId) ?? 0) + qty);
    if (typeof line.expectedPriceSatang === "number" && Number.isFinite(line.expectedPriceSatang))
      expectedByVariant.set(variantId, line.expectedPriceSatang);
  }
  const lines = [...qtyByVariant].map(([variantId, qty]) => ({
    variantId,
    qty,
    expectedPriceSatang: expectedByVariant.get(variantId),
  }));
  if (lines.some((l) => l.qty > 99)) return "จำนวนสินค้าไม่ถูกต้อง (1-99 ชิ้นต่อรายการ)";

  return { idempotencyRef: ref, name, addressId, address, paymentMethod, couponCode, lines };
}

/** The success payload for an order that already exists (idempotent replay — no re-insert). */
async function replayPayload(
  db: D1Database,
  ref: string,
  paymentMethod: CheckoutPaymentMethod,
  order: {
    id: string;
    grand: number;
    discount: number | null;
    shipping: number | null;
    createdAt: number | null;
  },
): Promise<CheckoutSuccess> {
  const [payment, count, redemption] = await Promise.all([
    db
      .prepare(`SELECT promptpay_id AS promptpayId FROM payments WHERE sales_order_id = ? LIMIT 1`)
      .bind(order.id)
      .first<{ promptpayId: string }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(quantity), 0) AS n FROM sales_order_lines WHERE sales_order_id = ?`,
      )
      .bind(order.id)
      .first<{ n: number }>(),
    // The recorded coupon (if any) — read from the redemption row, not the replayed body.
    db
      .prepare(
        `SELECT c.code AS code FROM coupon_redemptions r
         JOIN coupons c ON c.id = r.coupon_id WHERE r.sales_order_id = ? LIMIT 1`,
      )
      .bind(order.id)
      .first<{ code: string }>(),
  ]);
  return {
    ref,
    orderId: order.id,
    paymentMethod,
    amountSatang: order.grand,
    shippingSatang: order.shipping ?? 0,
    promptpayId: payment?.promptpayId ? payment.promptpayId : null,
    itemCount: count?.n ?? 0,
    createdAt: order.createdAt ?? Date.now(),
    discountSatang: order.discount ?? 0,
    ...(redemption ? { couponCode: redemption.code } : {}),
  };
}

/**
 * Deduct the order's stock through apps/api's StockLedger DO. Idempotent on the order id, so
 * calling it again on an idempotent checkout replay is a no-op. FAIL-OPEN by design: the
 * customer's order is already placed and unpaid — a ledger blip must not destroy it. The
 * pre-checkout on-hand check already gated overselling; any race-window conflict is logged
 * loudly for the owner to resolve (same reality as a marketplace oversell).
 * In local `next dev` the cross-Worker binding is unresolvable → logged and skipped.
 */
async function deductStockBestEffort(
  orderId: string,
  lines: { variantId: string; qty: number }[],
): Promise<void> {
  try {
    const { STOCK_LEDGER } = await getEnv();
    if (!STOCK_LEDGER) {
      console.warn(`[checkout] stock deduction skipped — no STOCK_LEDGER binding (local dev?)`);
      return;
    }
    const stub = STOCK_LEDGER.get(STOCK_LEDGER.idFromName("default")) as unknown as {
      applyOnlineSale(
        orderId: string,
        lines: { productVariantId: string; quantity: number }[],
      ): Promise<{ applied: boolean; duplicate: boolean; conflicts: unknown[] }>;
    };
    const result = await stub.applyOnlineSale(
      orderId,
      lines.map((l) => ({ productVariantId: l.variantId, quantity: l.qty })),
    );
    if (result.conflicts.length > 0) {
      console.error(`[checkout] STOCK CONFLICT on order ${orderId}:`, result.conflicts);
    }
  } catch (err) {
    console.error(`[checkout] stock deduction failed for order ${orderId}`, err);
  }
}

/** Undo campaign sold_count increments after a mid-flight failure (best effort, logged loudly). */
async function compensateCampaignIncrements(
  db: D1Database,
  incremented: { id: string; qty: number }[],
): Promise<void> {
  for (const inc of incremented) {
    try {
      await db
        .prepare(`UPDATE campaign_prices SET sold_count = sold_count - ? WHERE id = ?`)
        .bind(inc.qty, inc.id)
        .run();
    } catch (err) {
      console.error(`[checkout] FAILED to compensate campaign_prices ${inc.id} by ${inc.qty}`, err);
    }
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
    }
    const parsed = parseBody(raw);
    if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
    const body = parsed;
    const ref = body.idempotencyRef;

    // 1) Login gate — the session is the ONLY customer identity (never the request body).
    const customer = await getSession();
    if (!customer)
      return Response.json(
        { error: "กรุณาเข้าสู่ระบบก่อนสั่งซื้อ", requiresLogin: true },
        { status: 401 },
      );

    const db = await getDb();

    // 2) Idempotency FIRST: same ref → same order, same payload, no second insert. Scoped to
    //    this customer so a foreign ref can never leak another customer's order details.
    const existing = await db
      .prepare(
        `SELECT id, grand_total_satang AS grand, discount_total_satang AS discount,
                shipping_fee_satang AS shipping, order_created_at AS createdAt
         FROM sales_orders
         WHERE channel = 'airplus' AND external_order_id = ? AND storefront_customer_id = ?`,
      )
      .bind(ref, customer.id)
      .first<{
        id: string;
        grand: number;
        discount: number | null;
        shipping: number | null;
        createdAt: number | null;
      }>();
    if (existing) {
      // Replay-safe deduction: use the order's STORED lines (not the request body, which a
      // tampered replay could alter) — the DO no-ops if this order's ledger rows already exist.
      const stored = await db
        .prepare(
          `SELECT product_variant_id AS variantId, quantity AS qty
           FROM sales_order_lines WHERE sales_order_id = ?`,
        )
        .bind(existing.id)
        .all<{ variantId: string; qty: number }>();
      await deductStockBestEffort(existing.id, stored.results ?? []);
      return Response.json(await replayPayload(db, ref, body.paymentMethod, existing));
    }

    const now = Date.now();

    // 3) One-time name capture: '' means "not captured yet" — require it, set it, never overwrite.
    let buyerName = customer.name;
    if (buyerName === "") {
      if (!body.name) return Response.json({ error: "กรุณากรอกชื่อ-นามสกุล" }, { status: 400 });
      buyerName = body.name;
      await db
        .prepare(
          `UPDATE storefront_customers SET name = ?, updated_at = ? WHERE id = ? AND name = ''`,
        )
        .bind(buyerName, now, customer.id)
        .run();
    }

    // 4) Address: a saved id (must be OWNED by this customer) or a new address to save.
    let shippingAddressId: string;
    let shippingPostcode: string;
    let addressInsert: ReturnType<D1Database["prepare"]> | null = null;
    if (body.addressId) {
      const owned = await db
        .prepare(
          `SELECT id, postal_code AS postalCode FROM addresses
           WHERE id = ? AND storefront_customer_id = ?`,
        )
        .bind(body.addressId, customer.id)
        .first<{ id: string; postalCode: string }>();
      if (!owned)
        return Response.json(
          { error: "ไม่พบที่อยู่ที่เลือก กรุณาเลือกที่อยู่ใหม่" },
          { status: 400 },
        );
      shippingAddressId = owned.id;
      shippingPostcode = owned.postalCode;
    } else {
      const a = body.address;
      if (!a)
        return Response.json({ error: "กรุณากรอกที่อยู่จัดส่งให้ครบทุกช่อง" }, { status: 400 });
      const hasAny = await db
        .prepare(`SELECT id FROM addresses WHERE storefront_customer_id = ? LIMIT 1`)
        .bind(customer.id)
        .first<{ id: string }>();
      shippingAddressId = crypto.randomUUID();
      shippingPostcode = a.postalCode;
      addressInsert = db
        .prepare(
          `INSERT INTO addresses (id, storefront_customer_id, recipient_name, phone, address_line1,
             subdistrict, district, province, postal_code, is_default, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          shippingAddressId,
          customer.id,
          a.recipientName,
          a.phone,
          a.addressLine1,
          a.subdistrict,
          a.district,
          a.province,
          a.postalCode,
          hasAny ? 0 : 1, // first address becomes the default
          now,
        );
    }

    // 5) Re-price EVERY line server-side, campaign-aware (never trust the client).
    const pricing = await getCheckoutPricing(
      db,
      body.lines.map((l) => l.variantId),
      now,
    );
    const priced: {
      variantId: string;
      qty: number;
      name: string;
      priceSatang: number;
      costSatang: number;
      /** set ONLY when the effective price came from a live campaign (cap accounting) */
      campaignPriceId: string | null;
      weightGrams: number;
      widthMm: number | null;
      lengthMm: number | null;
      heightMm: number | null;
    }[] = [];
    let priceChanged = false;
    for (const line of body.lines) {
      const row = pricing.get(line.variantId);
      if (!row)
        return Response.json(
          { error: "มีสินค้าในตะกร้าที่ไม่พร้อมจำหน่ายแล้ว กรุณาลบออกแล้วลองใหม่" },
          { status: 400 },
        );
      if (row.priceSatang <= 0)
        return Response.json({ error: `สินค้ายังไม่เปิดขายออนไลน์: ${row.name}` }, { status: 400 });
      // Fail closed like the POS — never oversell.
      if (line.qty > row.onHand)
        return Response.json(
          { error: `สินค้าไม่พอ: ${row.name} (เหลือ ${row.onHand} ชิ้น)` },
          { status: 400 },
        );
      const eff = resolveEffectivePrice(row.priceSatang, row.campaign, now);
      // The customer must never be charged more than the price they saw without re-confirming: if a
      // shown price no longer matches (e.g. a flash price lapsed in-cart), flag it and bail below.
      if (line.expectedPriceSatang != null && line.expectedPriceSatang !== eff.priceSatang)
        priceChanged = true;
      priced.push({
        variantId: line.variantId,
        qty: line.qty,
        name: row.name,
        priceSatang: eff.priceSatang,
        costSatang: row.costSatang,
        campaignPriceId: eff.onSale ? row.campaignPriceId : null,
        weightGrams: row.weightGrams,
        widthMm: row.widthMm,
        lengthMm: row.lengthMm,
        heightMm: row.heightMm,
      });
    }

    // A shown price no longer matches — return the new prices and let the customer re-confirm the
    // updated total. No order, no reservations, no coupon write happened yet, so this is side-effect
    // free.
    if (priceChanged)
      return Response.json(
        {
          error: "ราคาสินค้ามีการเปลี่ยนแปลง กรุณาตรวจสอบยอดรวมแล้วยืนยันอีกครั้ง",
          reason: "prices_changed",
          lines: priced.map((p) => ({ variantId: p.variantId, priceSatang: p.priceSatang })),
        },
        { status: 409 },
      );

    const subtotal = priced.reduce((sum, p) => sum + p.priceSatang * p.qty, 0);
    const itemCount = priced.reduce((sum, p) => sum + p.qty, 0);

    // 6) Coupon (optional) — validated against the EFFECTIVE subtotal, before any state changes.
    let coupon: {
      id: string;
      code: string;
      maxUses: number | null;
      maxUsesPerCustomer: number;
    } | null = null;
    let discount = 0;
    if (body.couponCode) {
      const found = await getCouponWithUsage(db, body.couponCode, customer.id);
      if (!found)
        return Response.json({ error: couponReasonThai("not_found", 0) }, { status: 400 });
      const verdict = validateCoupon(found.coupon, subtotal, now, found.usage);
      if (!verdict.ok)
        return Response.json(
          { error: couponReasonThai(verdict.reason, found.coupon.minSubtotalSatang) },
          { status: 400 },
        );
      coupon = {
        id: found.coupon.id,
        code: found.coupon.code,
        maxUses: found.coupon.maxUses,
        maxUsesPerCustomer: found.coupon.maxUsesPerCustomer,
      };
      discount = couponDiscountSatang(found.coupon, subtotal);
    }
    // 6b) Shipping fee — computed server-side from parcel weight/dims × destination,
    //     never trusted from the client (same rule as pricing). A pass-through the
    //     customer pays: it lands in grand_total but NOT in sales_satang or profit.
    const isRemote = isRemotePostcode(shippingPostcode, FLASH_TH_REMOTE_POSTCODES);
    const shipping = quoteShippingSatang(
      priced.map((p) => ({
        weightGrams: p.weightGrams,
        dims: { widthMm: p.widthMm, lengthMm: p.lengthMm, heightMm: p.heightMm },
        qty: p.qty,
      })),
      isRemote,
      FLASH_TH_RATE_CARD,
    );
    const grand = subtotal - discount + shipping;
    const profit =
      priced.reduce((sum, p) => sum + (p.priceSatang - p.costSatang) * p.qty, 0) - discount;

    // 7) Default PromptPay target from shop settings (same KV the POS/admin uses).
    let promptpayId: string | null = null;
    if (body.paymentMethod !== "cod") {
      const { KV } = await getEnv();
      // AirPlus's OWN account — Den Air Service takes money into a different one, so this must
      // never fall back to the workshop's profile.
      const methods = parsePaymentMethods(await KV.get(shopKey("airplus", "paymentMethods")));
      promptpayId = defaultPaymentMethod(methods)?.promptpayId ?? null;
    }

    // 8) Flash-sale caps BEFORE the main batch: guarded increments that can never exceed
    //    stock_cap (D1 serializes writes → race-free). Any failure compensates prior increments.
    const incremented: { id: string; qty: number }[] = [];
    for (const p of priced) {
      if (!p.campaignPriceId) continue;
      const res = await db
        .prepare(
          `UPDATE campaign_prices SET sold_count = sold_count + ?
           WHERE id = ? AND (stock_cap IS NULL OR sold_count + ? <= stock_cap)`,
        )
        .bind(p.qty, p.campaignPriceId, p.qty)
        .run();
      if (!res.meta.changes) {
        await compensateCampaignIncrements(db, incremented);
        return Response.json(
          { error: "สินค้าแฟลชเซลถูกจองเต็มแล้ว กรุณาลองใหม่อีกครั้ง" },
          { status: 409 },
        );
      }
      incremented.push({ id: p.campaignPriceId, qty: p.qty });
    }

    // 8b) Coupon redemption — a guarded insert that can't exceed maxUses / maxUsesPerCustomer even
    //     under concurrent checkouts: the WHERE re-counts inside the single write and D1 serializes
    //     writes, closing the validate→insert race. validateCoupon already handled the common case.
    const orderId = crypto.randomUUID();
    const redemptionId = crypto.randomUUID();
    if (coupon) {
      const res = await db
        .prepare(
          `INSERT INTO coupon_redemptions (id, coupon_id, customer_id, sales_order_id, amount_discounted_satang, created_at)
           SELECT ?, ?, ?, ?, ?, ?
           WHERE (? IS NULL OR (SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = ?) < ?)
             AND (SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = ? AND customer_id = ?) < ?`,
        )
        .bind(
          redemptionId,
          coupon.id,
          customer.id,
          orderId,
          discount,
          now,
          coupon.maxUses,
          coupon.id,
          coupon.maxUses,
          coupon.id,
          customer.id,
          coupon.maxUsesPerCustomer,
        )
        .run();
      if (!res.meta.changes) {
        await compensateCampaignIncrements(db, incremented);
        return Response.json({ error: "คูปองถูกใช้ครบจำนวนแล้ว" }, { status: 409 });
      }
    }

    // 9) (Address +) order + lines (+ payment) in ONE atomic D1 batch. The coupon redemption is
    //    written above (8b) with its own concurrency guard.
    // English constants, matching packages/core/src/orderStatus.ts. These used to be the Thai
    // literals migration 0069 exists to retire, so every new order landed pre-0069 no matter how
    // many times the migration ran. Readers normalize either language (core/legacyStatus), so the
    // deploy and the migration no longer have to be sequenced.
    const paymentStatus: PaymentStatus = body.paymentMethod === "cod" ? "cod" : "pending";
    const statements = [
      ...(addressInsert ? [addressInsert] : []),
      db
        .prepare(
          // shipping_auto_satang and shipping_fee_satang are the same number here, and that is not
          // redundancy: the first is what our rate card QUOTED, the second is what we CHARGED. They
          // are equal on a normal order and diverge the moment the owner absorbs part of a heavy
          // parcel's fee. The quote has to be written now or it is gone — sales_order_lines keeps no
          // weight and no dimensions, so nothing downstream can recompute it.
          `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
             subtotal_satang, discount_total_satang, tax_total_satang, fee_total_satang,
             shipping_fee_satang, shipping_auto_satang, grand_total_satang, order_created_at,
             imported_at, import_source, buyer_username, sales_satang, fee_bp, profit_satang,
             storefront_customer_id, shipping_address_id)
           VALUES (?, 'airplus', ?, 'new', ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, 'api', ?, ?, 0, ?, ?, ?)`,
        )
        .bind(
          orderId,
          ref,
          paymentStatus,
          subtotal,
          discount,
          shipping,
          shipping,
          grand,
          now,
          now,
          buyerName,
          subtotal,
          profit,
          customer.id,
          shippingAddressId,
        ),
      ...priced.map((p) =>
        db
          .prepare(
            `INSERT INTO sales_order_lines (id, sales_order_id, product_variant_id, quantity,
               unit_price_satang, unit_cost_satang, line_total_satang, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            orderId,
            p.variantId,
            p.qty,
            p.priceSatang,
            p.costSatang,
            p.priceSatang * p.qty,
            now,
          ),
      ),
      // Opening entry for the order timeline that admin /orders/:id renders. It goes in this batch
      // on purpose: an order that exists with no history would render a blank timeline, and this
      // route bypasses the API's audit wrapper entirely (it writes to D1 directly), so nothing else
      // would record the creation. actor_email is null — the customer placed it, not a staff member.
      db
        .prepare(
          `INSERT INTO order_status_history
             (id, order_id, order_status, payment_status, event, actor_email, note, created_at)
           VALUES (?, ?, ?, ?, 'created', NULL, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          orderId,
          "new",
          paymentStatus,
          `placed via storefront checkout (${body.paymentMethod === "cod" ? "COD" : "transfer"})`,
          now,
        ),
    ];
    if (body.paymentMethod !== "cod") {
      statements.push(
        db
          .prepare(
            `INSERT INTO payments (id, method_label, promptpay_id, amount_satang, status,
               created_at, sales_order_id)
             VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
          )
          .bind(crypto.randomUUID(), `AirPlus ${ref}`, promptpayId ?? "", grand, now, orderId),
      );
    }
    try {
      await db.batch(statements);
    } catch (err) {
      // The order didn't happen — release the flash-sale reservations AND the coupon redemption we
      // pre-inserted in (8b), before failing loudly, so neither is left dangling.
      await compensateCampaignIncrements(db, incremented);
      if (coupon)
        await db
          .prepare("DELETE FROM coupon_redemptions WHERE id = ?")
          .bind(redemptionId)
          .run()
          .catch(() => {});
      throw err;
    }

    // 10) Deduct stock through the shared ledger DO (idempotent on orderId; fail-open — above).
    await deductStockBestEffort(
      orderId,
      priced.map((p) => ({ variantId: p.variantId, qty: p.qty })),
    );

    const payload: CheckoutSuccess = {
      ref,
      orderId,
      paymentMethod: body.paymentMethod,
      amountSatang: grand,
      shippingSatang: shipping,
      promptpayId,
      itemCount,
      createdAt: now,
      discountSatang: discount,
      ...(coupon ? { couponCode: coupon.code } : {}),
    };
    return Response.json(payload);
  } catch (err) {
    console.error("POST /api/checkout failed", err);
    return Response.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

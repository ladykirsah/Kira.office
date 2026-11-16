import type { D1Database } from "@cloudflare/workers-types";

/**
 * The customer's own address book. An address an order (or a claim's replacement part) was sent to
 * is never deleted: removing it hides it (hidden_at), so the order keeps its delivery address and
 * the customer no longer sees or picks it — the Shopee way (owner's pick A, 16 Nov 2026).
 */

export interface OwnAddress {
  id: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  isDefault: boolean;
}

/** The customer's addresses they can see and pick: default first, then the newest. */
export async function listOwnAddresses(db: D1Database, customerId: string): Promise<OwnAddress[]> {
  const rows = await db
    .prepare(
      `SELECT id, recipient_name AS recipientName, phone, address_line1 AS addressLine1,
              subdistrict, district, province, postal_code AS postalCode, is_default AS isDefault
       FROM addresses WHERE storefront_customer_id = ? AND hidden_at IS NULL
       ORDER BY is_default DESC, created_at DESC LIMIT 20`,
    )
    .bind(customerId)
    .all<Omit<OwnAddress, "isDefault"> & { isDefault: number }>();
  return (rows.results ?? []).map((a) => ({ ...a, isDefault: Boolean(a.isDefault) }));
}

/** One of the customer's visible addresses (checkout, "make default"), or null. */
export async function findOwnAddress(
  db: D1Database,
  customerId: string,
  id: string,
): Promise<{ id: string; postalCode: string } | null> {
  return db
    .prepare(
      `SELECT id, postal_code AS postalCode FROM addresses
       WHERE id = ? AND storefront_customer_id = ? AND hidden_at IS NULL`,
    )
    .bind(id, customerId)
    .first<{ id: string; postalCode: string }>();
}

/** Whether the customer has any visible address; a first one becomes the default. */
export async function hasOwnAddress(db: D1Database, customerId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id FROM addresses WHERE storefront_customer_id = ? AND hidden_at IS NULL LIMIT 1`,
    )
    .bind(customerId)
    .first<{ id: string }>();
  return row !== null;
}

/**
 * Remove ONE of the customer's own addresses. One an order or a claim was sent to is hidden, not
 * deleted (deleting it hit the order's link and answered "system error", bug hunt 15 Nov 2026).
 * Someone else's address, one already removed, or none is the same not-found.
 */
export async function deleteOwnAddress(
  db: D1Database,
  customerId: string,
  id: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!(await findOwnAddress(db, customerId, id))) {
    return { status: 404, body: { error: "ไม่พบที่อยู่" } };
  }
  const used = await db
    .prepare(
      `SELECT 1 AS used FROM sales_orders WHERE shipping_address_id = ?1
       UNION ALL SELECT 1 FROM order_claims WHERE replacement_address_id = ?1 LIMIT 1`,
    )
    .bind(id)
    .first<{ used: number }>();
  if (used) {
    await db
      .prepare(
        `UPDATE addresses SET hidden_at = ?, is_default = 0
         WHERE id = ? AND storefront_customer_id = ?`,
      )
      .bind(Date.now(), id, customerId)
      .run();
  } else {
    await db
      .prepare(`DELETE FROM addresses WHERE id = ? AND storefront_customer_id = ?`)
      .bind(id, customerId)
      .run();
  }
  return { status: 200, body: { ok: true } };
}

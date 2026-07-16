import { getSession, guardMutation } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** DELETE /api/account/addresses/:id — remove ONE OWN address. */
export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const customer = await getSession();
    if (!customer) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id } = await props.params;
    const db = await getDb();
    // Ownership enforced in the WHERE — deleting someone else's address is a silent no-op 404.
    const res = await db
      .prepare(`DELETE FROM addresses WHERE id = ? AND storefront_customer_id = ?`)
      .bind(id, customer.id)
      .run();
    if ((res.meta?.changes ?? 0) === 0)
      return Response.json({ error: "ไม่พบที่อยู่" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/account/addresses/:id failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
  }
}

/** PATCH /api/account/addresses/:id — edit ONE OWN address's fields; optionally make it the default. */
export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;
    const customer = await getSession();
    if (!customer) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id } = await props.params;
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const field = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
    const recipientName = field("recipientName");
    const phone = field("phone");
    const addressLine1 = field("addressLine1");
    const subdistrict = field("subdistrict");
    const district = field("district");
    const province = field("province");
    const postalCode = field("postalCode");
    if (!recipientName || !phone || !addressLine1 || !subdistrict || !district || !province)
      return Response.json({ error: "กรุณากรอกที่อยู่ให้ครบทุกช่อง" }, { status: 400 });
    if (!/^\d{5}$/.test(postalCode))
      return Response.json({ error: "กรุณากรอกรหัสไปรษณีย์ 5 หลัก" }, { status: 400 });

    const db = await getDb();
    const owned = await db
      .prepare(`SELECT id FROM addresses WHERE id = ? AND storefront_customer_id = ?`)
      .bind(id, customer.id)
      .first<{ id: string }>();
    if (!owned) return Response.json({ error: "ไม่พบที่อยู่" }, { status: 404 });

    const makeDefault = b.isDefault === true;
    const fieldsSql = `recipient_name = ?, phone = ?, address_line1 = ?, subdistrict = ?, district = ?, province = ?, postal_code = ?`;
    const fieldBinds = [
      recipientName,
      phone,
      addressLine1,
      subdistrict,
      district,
      province,
      postalCode,
    ];
    // Only promote to default here (clear others first) — never un-set the default from an edit, so
    // the customer can't accidentally end up with zero default addresses.
    const statements = makeDefault
      ? [
          db
            .prepare(`UPDATE addresses SET is_default = 0 WHERE storefront_customer_id = ?`)
            .bind(customer.id),
          db
            .prepare(
              `UPDATE addresses SET ${fieldsSql}, is_default = 1 WHERE id = ? AND storefront_customer_id = ?`,
            )
            .bind(...fieldBinds, id, customer.id),
        ]
      : [
          db
            .prepare(
              `UPDATE addresses SET ${fieldsSql} WHERE id = ? AND storefront_customer_id = ?`,
            )
            .bind(...fieldBinds, id, customer.id),
        ];
    await db.batch(statements);
    return Response.json({ ok: true, isDefault: makeDefault });
  } catch (err) {
    console.error("PATCH /api/account/addresses/:id failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
  }
}

/** POST /api/account/addresses/:id — make ONE OWN address the default. */
export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;
    const customer = await getSession();
    if (!customer) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id } = await props.params;
    const db = await getDb();
    const owned = await db
      .prepare(`SELECT id FROM addresses WHERE id = ? AND storefront_customer_id = ?`)
      .bind(id, customer.id)
      .first<{ id: string }>();
    if (!owned) return Response.json({ error: "ไม่พบที่อยู่" }, { status: 404 });
    await db.batch([
      db
        .prepare(`UPDATE addresses SET is_default = 0 WHERE storefront_customer_id = ?`)
        .bind(customer.id),
      db.prepare(`UPDATE addresses SET is_default = 1 WHERE id = ?`).bind(id),
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/account/addresses/:id failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
  }
}

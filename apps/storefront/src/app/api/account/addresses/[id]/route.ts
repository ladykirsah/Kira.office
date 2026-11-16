import { getSession, guardMutation } from "@/lib/auth";
import { deleteOwnAddress, findOwnAddress } from "@/lib/addressBook";
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
    // Own addresses only; one an order was sent to is hidden, not deleted (lib/addressBook).
    const out = await deleteOwnAddress(await getDb(), customer.id, id);
    return Response.json(out.body, { status: out.status });
  } catch (err) {
    console.error("DELETE /api/account/addresses/:id failed", err);
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
    // Own, visible addresses only: a removed one can't become the default.
    if (!(await findOwnAddress(db, customer.id, id)))
      return Response.json({ error: "ไม่พบที่อยู่" }, { status: 404 });
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

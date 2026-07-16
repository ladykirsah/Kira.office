import { displayNameError, normalizeDisplayName } from "@l-shopee/core";
import { getSession, guardMutation } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * PATCH /api/account/profile { name }
 *
 * Lets a customer set or CORRECT their own name. Until now nothing could: registration never asked,
 * checkout captured it once with `WHERE name = ''`, and no endpoint existed to change it — so a
 * name typed wrong at first checkout was permanent.
 *
 * Session-only: the name belongs to whoever is logged in, and the id comes from the session cookie,
 * never from the request body — so this cannot be pointed at another customer's row.
 */
export const dynamic = "force-dynamic";

export async function PATCH(req: Request): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;

    const customer = await getSession();
    if (!customer) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { name?: unknown };
    const raw = typeof body.name === "string" ? body.name : "";
    const error = displayNameError(raw);
    if (error) return Response.json({ error }, { status: 400 });

    const name = normalizeDisplayName(raw);
    const db = await getDb();
    // No `AND name = ''` guard here — unlike checkout's one-time capture, correcting the name is
    // exactly what this endpoint is for.
    await db
      .prepare(`UPDATE storefront_customers SET name = ?, updated_at = ? WHERE id = ?`)
      .bind(name, Date.now(), customer.id)
      .run();

    return Response.json({ ok: true, name });
  } catch {
    return Response.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}

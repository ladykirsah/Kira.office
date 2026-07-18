import { cookies } from "next/headers";
import { createSession, guardMutation, sessionCookieOptions } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/authCore";
import { getEnv } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { LINE_PENDING_COOKIE, takeLinePending } from "@/lib/lineAuth";

/**
 * POST /api/auth/line/register — finish a first-time LINE signup by attaching a phone
 * (LINE never gives us one) + PDPA consent, then create the account and log in. The
 * verified LINE identity comes from the KV-backed pending record set by /callback, not
 * the request body, so a caller can't register an arbitrary LINE id.
 */

const EXPIRED = "เซสชันหมดอายุ กรุณาเข้าสู่ระบบด้วย LINE อีกครั้ง";

export async function POST(request: Request): Promise<Response> {
  try {
    const guarded = guardMutation(request);
    if (guarded) return guarded;

    const body = (await request.json().catch(() => null)) as {
      phone?: unknown;
      pdpaConsent?: unknown;
    } | null;

    const phone = normalizePhone(typeof body?.phone === "string" ? body.phone : "");
    if (phone.length < 9 || phone.length > 10)
      return Response.json({ error: "กรุณากรอกเบอร์โทรศัพท์ 9-10 หลัก" }, { status: 400 });
    if (body?.pdpaConsent !== true)
      return Response.json(
        { requiresConsent: true, error: "กรุณายอมรับนโยบายความเป็นส่วนตัวเพื่อสร้างบัญชี" },
        { status: 400 },
      );

    const cookieStore = await cookies();
    const token = cookieStore.get(LINE_PENDING_COOKIE)?.value;
    if (!token) return Response.json({ error: EXPIRED }, { status: 400 });

    const env = await getEnv();
    const pending = await takeLinePending(env, token);
    if (!pending) return Response.json({ error: EXPIRED }, { status: 400 });

    const db = env.DB;
    const now = Date.now();

    // Idempotency: a double-submit / back-button may re-run this for a LINE id that
    // already got an account — just log that account in.
    const existingByLine = await db
      .prepare(`SELECT id FROM storefront_customers WHERE line_user_id = ?`)
      .bind(pending.lineUserId)
      .first<{ id: string }>();

    let customerId: string;
    if (existingByLine) {
      customerId = existingByLine.id;
    } else {
      // phone is UNIQUE. Linking a LINE id onto an existing phone-account would need phone
      // verification we don't do here → reject rather than risk an account takeover.
      const phoneTaken = await db
        .prepare(`SELECT id FROM storefront_customers WHERE phone = ?`)
        .bind(phone)
        .first<{ id: string }>();
      if (phoneTaken)
        return Response.json(
          { error: "เบอร์นี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบด้วยเบอร์โทร" },
          { status: 409 },
        );

      customerId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO storefront_customers
             (id, phone, name, line_user_id, pdpa_consent_at, last_login_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(customerId, phone, pending.name, pending.lineUserId, now, now, now, now)
        .run();
    }

    const session = await createSession(db, customerId);
    cookieStore.set(SESSION_COOKIE, session.token, sessionCookieOptions());
    cookieStore.delete(LINE_PENDING_COOKIE);
    return Response.json({ customer: { id: customerId, phone, name: pending.name } });
  } catch (err) {
    console.error("POST /api/auth/line/register failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

import { phoneChangeError } from "@l-shopee/core";
import { OTP_MAX_ATTEMPTS, hashOtp } from "@/lib/authCore";
import { getSession, guardMutation } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

/**
 * POST /api/account/phone { phone, code }
 *
 * Changes the account's login phone. This is a CREDENTIAL change, so it needs both halves of the
 * proof and accepts nothing less:
 *
 *   1. You are the account  — a valid session cookie. The customer id is taken from the session,
 *      never the body, so this endpoint cannot be aimed at somebody else's row.
 *   2. You own the new number — a live OTP that was sent to it. The code is verified here with the
 *      same atomic attempt-slot + guarded-consume dance as /api/auth/otp/verify: concurrent calls
 *      cannot race past the attempt cap or spend one code twice.
 *
 * The client obtains that code from /api/auth/otp/send with mode:'register', which already refuses
 * numbers that belong to an existing account — so an OTP is never even sent to someone else's phone.
 *
 * Why the takeover guard is load-bearing: the phone is not only the login. Guest order tracking
 * resolves orders by (ref, phone) joined to this column, so taking over a number would take over
 * every order behind it. The UNIQUE index on phone is the final backstop, and its failure is caught
 * below and reported as a normal refusal rather than a 500.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;

    const customer = await getSession();
    if (!customer) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { phone?: unknown; code?: unknown };
    const nextPhone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
    const code = (typeof body.code === "string" ? body.code : "").trim();
    if (!/^\d{6}$/.test(code)) return Response.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });

    const db = await getDb();
    const now = Date.now();

    const taken = await db
      .prepare(`SELECT 1 FROM storefront_customers WHERE phone = ? AND id <> ? LIMIT 1`)
      .bind(nextPhone, customer.id)
      .first();

    const refusal = phoneChangeError({
      currentPhone: normalizePhone(customer.phone),
      nextPhone,
      taken: Boolean(taken),
    });
    if (refusal) return Response.json({ error: refusal }, { status: 400 });

    // The code must belong to the NEW number — proving the person holds it right now.
    const otp = await db
      .prepare(
        `SELECT id, code_hash AS codeHash, salt FROM auth_otp_codes
          WHERE phone = ? AND consumed_at IS NULL AND expires_at > ?
          ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(nextPhone, now)
      .first<{ id: string; codeHash: string; salt: string }>();
    if (!otp)
      return Response.json({ error: "รหัสหมดอายุหรือไม่ถูกต้อง กรุณาขอรหัสใหม่" }, { status: 410 });

    const slot = await db
      .prepare(
        `UPDATE auth_otp_codes SET attempts = attempts + 1
          WHERE id = ? AND attempts < ? AND consumed_at IS NULL`,
      )
      .bind(otp.id, OTP_MAX_ATTEMPTS)
      .run();
    if ((slot.meta?.changes ?? 0) === 0)
      return Response.json({ error: "ใส่รหัสผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่" }, { status: 429 });

    if ((await hashOtp(code, otp.salt)) !== otp.codeHash)
      return Response.json({ error: "รหัสไม่ถูกต้อง" }, { status: 401 });

    // Consume FIRST, guarded: if this returns 0 rows another request already spent the code, and the
    // phone must not move on the strength of a code that is no longer live.
    const consumed = await db
      .prepare(`UPDATE auth_otp_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`)
      .bind(now, otp.id)
      .run();
    if ((consumed.meta?.changes ?? 0) === 0)
      return Response.json({ error: "รหัสนี้ถูกใช้ไปแล้ว กรุณาขอรหัสใหม่" }, { status: 409 });

    try {
      await db
        .prepare(
          `UPDATE storefront_customers
              SET phone = ?, phone_verified_at = ?, updated_at = ?
            WHERE id = ?`,
        )
        .bind(nextPhone, now, now, customer.id)
        .run();
    } catch {
      // The UNIQUE index fired between our check and this write — someone registered that number in
      // the gap. A refusal, not a crash.
      return Response.json({ error: "เบอร์นี้มีบัญชีอื่นใช้อยู่แล้ว" }, { status: 409 });
    }

    console.info(`[account] phone changed for customer ${customer.id}`);
    return Response.json({ ok: true, phone: nextPhone });
  } catch {
    return Response.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}

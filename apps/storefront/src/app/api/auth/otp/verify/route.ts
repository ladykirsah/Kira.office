import { cookies } from "next/headers";
import { OTP_MAX_ATTEMPTS, SESSION_COOKIE, hashOtp } from "@/lib/authCore";
import { createSession, guardMutation, sessionCookieOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

/**
 * POST /api/auth/otp/verify { phone, code, pdpaConsent? }
 * Verifies the newest live code for the phone and logs the customer in (creating the account on
 * first login). Attempt-count and consume are ATOMIC guarded UPDATEs checked via meta.changes —
 * concurrent verifies cannot race past the 5-attempt cap or double-consume a code. A NEW account
 * requires pdpaConsent: true on this same request (a customer row must never exist without its
 * PDPA consent timestamp). Existing accounts created before consent capture get their consent
 * recorded here too.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;
    const body = (await req.json().catch(() => ({}))) as {
      phone?: string;
      code?: string;
      pdpaConsent?: boolean;
    };
    const phone = normalizePhone(body.phone ?? "");
    const code = (body.code ?? "").trim();
    if (phone.length < 9 || phone.length > 10 || !/^\d{6}$/.test(code))
      return Response.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });

    const db = await getDb();
    const now = Date.now();

    const otp = await db
      .prepare(
        `SELECT id, code_hash AS codeHash, salt FROM auth_otp_codes
         WHERE phone = ? AND consumed_at IS NULL AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(phone, now)
      .first<{ id: string; codeHash: string; salt: string }>();
    if (!otp)
      return Response.json({ error: "รหัสหมดอายุหรือไม่ถูกต้อง กรุณาขอรหัสใหม่" }, { status: 410 });

    // Atomic attempt slot — refuses once the cap is reached, even under concurrency.
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

    // Consent check BEFORE consuming: a new user who missed the PDPA checkbox keeps their code
    // valid (one attempt was spent, nothing more) instead of burning a whole SMS.
    const existing = await db
      .prepare(
        `SELECT id, COALESCE(name, '') AS name, pdpa_consent_at AS pdpaConsentAt
         FROM storefront_customers WHERE phone = ?`,
      )
      .bind(phone)
      .first<{ id: string; name: string; pdpaConsentAt: number | null }>();

    // Require PDPA consent before login for ANY account without a consent timestamp — a brand-new
    // phone OR a legacy/seed account whose pdpa_consent_at is still NULL. Only accounts that already
    // have consent on record log in without being asked again. Guarantees: no session is ever issued
    // for an account that has never consented.
    if ((!existing || existing.pdpaConsentAt === null) && body.pdpaConsent !== true)
      return Response.json(
        { requiresConsent: true, error: "กรุณายอมรับนโยบายความเป็นส่วนตัวเพื่อสร้างบัญชี" },
        { status: 400 },
      );

    // Atomic consume — a replayed correct code cannot log in twice.
    const consumed = await db
      .prepare(`UPDATE auth_otp_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`)
      .bind(now, otp.id)
      .run();
    if ((consumed.meta?.changes ?? 0) === 0)
      return Response.json({ error: "รหัสถูกใช้ไปแล้ว กรุณาขอรหัสใหม่" }, { status: 410 });

    let customerId: string;
    if (existing) {
      customerId = existing.id;
      await db
        .prepare(
          `UPDATE storefront_customers SET phone_verified_at = ?, last_login_at = ?, updated_at = ?,
             pdpa_consent_at = COALESCE(pdpa_consent_at, ?)
           WHERE id = ?`,
        )
        .bind(now, now, now, body.pdpaConsent === true ? now : null, customerId)
        .run();
    } else {
      customerId = crypto.randomUUID();
      // name '' = "not captured yet" sentinel (filled at first checkout, never overwritten).
      await db
        .prepare(
          `INSERT INTO storefront_customers
             (id, phone, name, phone_verified_at, pdpa_consent_at, last_login_at, created_at, updated_at)
           VALUES (?, ?, '', ?, ?, ?, ?, ?)
           ON CONFLICT(phone) DO UPDATE SET phone_verified_at = excluded.phone_verified_at,
             last_login_at = excluded.last_login_at, updated_at = excluded.updated_at`,
        )
        .bind(customerId, phone, now, now, now, now, now)
        .run();
      const row = await db
        .prepare(`SELECT id FROM storefront_customers WHERE phone = ?`)
        .bind(phone)
        .first<{ id: string }>();
      customerId = row?.id ?? customerId;
    }

    const session = await createSession(db, customerId);
    (await cookies()).set(SESSION_COOKIE, session.token, sessionCookieOptions());
    return Response.json({
      customer: { id: customerId, phone, name: existing?.name ?? "" },
    });
  } catch (err) {
    console.error("POST /api/auth/otp/verify failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

import {
  IP_SEND_WINDOW_MS,
  IP_SENDS_PER_WINDOW,
  OTP_SEND_DAY_MS,
  OTP_SEND_WINDOW_MS,
  OTP_SENDS_PER_DAY,
  OTP_SENDS_PER_WINDOW,
  OTP_TTL_MS,
  generateOtpCode,
  hashOtp,
  randomSessionToken,
} from "@/lib/authCore";
import { isAtLeastYears } from "@l-shopee/core";
import { clientIp, guardMutation, takeThrottle } from "@/lib/auth";
import { getDb, getEnv } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { sendOtpSms } from "@/lib/sms";
import { verifyTurnstile } from "@/lib/turnstile";

/**
 * POST /api/auth/otp/send { phone, mode?: "login" | "register", turnstileToken? }
 * Turnstile (when configured) is the primary anti-SMS-pumping gate; the D1 fixed-window
 * throttles (per phone AND per IP) are the backstop. Each send invalidates the phone's previous
 * unconsumed codes, so at most ONE code is ever guessable.
 *
 * REGISTRATION GATE (owner UX decision 2026-07-13): the login tab only sends to REGISTERED numbers,
 * the register tab only to NEW ones — an unregistered number can't reach the OTP step in login mode.
 * This deliberately REVEALS registration status (trades the old anti-enumeration property for a
 * clearer login-vs-register split); probing is still rate-limited by the throttles + Turnstile.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;
    const body = (await req.json().catch(() => ({}))) as {
      phone?: string;
      mode?: "login" | "register";
      turnstileToken?: string;
      dob?: string;
    };
    const phone = normalizePhone(body.phone ?? "");
    if (phone.length < 9 || phone.length > 10)
      return Response.json({ error: "กรุณากรอกเบอร์โทรศัพท์ 9-10 หลัก" }, { status: 400 });

    const env = await getEnv();
    const db = env.DB;
    const now = Date.now();
    const ip = clientIp(req);

    const [phoneOk, phoneDayOk, ipOk] = await Promise.all([
      takeThrottle(db, `otp:p10:${phone}`, OTP_SENDS_PER_WINDOW, OTP_SEND_WINDOW_MS, now),
      takeThrottle(db, `otp:p1d:${phone}`, OTP_SENDS_PER_DAY, OTP_SEND_DAY_MS, now),
      takeThrottle(db, `otp:ip:${ip}`, IP_SENDS_PER_WINDOW, IP_SEND_WINDOW_MS, now),
    ]);
    if (!phoneOk || !phoneDayOk || !ipOk)
      return Response.json(
        { error: "ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" },
        { status: 429 },
      );

    if (!(await verifyTurnstile(env, body.turnstileToken, ip)))
      return Response.json({ error: "การยืนยันความปลอดภัยไม่ผ่าน กรุณาลองใหม่" }, { status: 403 });

    // Registration gate — see the top-of-file note. Placed AFTER the throttle so any probing is
    // rate-limited. Rejected modes never generate a code or send an SMS.
    const mode = body.mode === "register" ? "register" : "login";
    const registered = await db
      .prepare(`SELECT 1 FROM storefront_customers WHERE phone = ? LIMIT 1`)
      .bind(phone)
      .first();
    if (mode === "login" && !registered)
      return Response.json(
        { notRegistered: true, error: "เบอร์นี้ยังไม่ได้สมัครสมาชิก กรุณากดสมัครสมาชิก" },
        { status: 404 },
      );
    if (mode === "register" && registered)
      return Response.json(
        { alreadyRegistered: true, error: "เบอร์นี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบ" },
        { status: 409 },
      );
    // Age gate — don't send an SMS to an under-20 registration (Terms §2). The client blocks this too;
    // verify re-checks authoritatively before the account is created.
    if (mode === "register" && !isAtLeastYears((body.dob ?? "").trim(), 20, now))
      return Response.json(
        { error: "ต้องมีอายุ 20 ปีบริบูรณ์ขึ้นไปจึงจะสมัครสมาชิกได้" },
        { status: 403 },
      );

    // Fixed code so the owner can walk the login flow with a predictable OTP (it is also echoed to
    // the UI). Gated on OTP_DEV_ECHO — set on STAGING (no SMS provider yet) but NEVER in production,
    // where the random code + Turnstile gate + a real SMS provider stay in force.
    const code = env.OTP_DEV_ECHO === "1" ? "123456" : generateOtpCode();
    const salt = randomSessionToken().slice(0, 16);
    await db.batch([
      // one live code per phone: kill prior unconsumed codes
      db
        .prepare(
          `UPDATE auth_otp_codes SET consumed_at = ? WHERE phone = ? AND consumed_at IS NULL`,
        )
        .bind(now, phone),
      db
        .prepare(
          `INSERT INTO auth_otp_codes (id, phone, code_hash, salt, purpose, expires_at, attempts, created_at)
           VALUES (?, ?, ?, ?, 'login', ?, 0, ?)`,
        )
        .bind(crypto.randomUUID(), phone, await hashOtp(code, salt), salt, now + OTP_TTL_MS, now),
      // housekeeping piggyback: drop long-expired sessions + stale OTP rows
      db
        .prepare(`DELETE FROM storefront_sessions WHERE expires_at < ?`)
        .bind(now - OTP_SEND_DAY_MS),
      db.prepare(`DELETE FROM auth_otp_codes WHERE expires_at < ?`).bind(now - OTP_SEND_DAY_MS),
    ]);

    const sms = await sendOtpSms(env, phone, code);
    if (!sms.sent)
      return Response.json(
        { error: "ส่ง SMS ไม่สำเร็จ กรุณาลองใหม่หรือติดต่อร้าน" },
        { status: 502 },
      );
    return Response.json({ sent: true, ...(sms.devEcho ? { devCode: sms.devEcho } : {}) });
  } catch (err) {
    console.error("POST /api/auth/otp/send failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

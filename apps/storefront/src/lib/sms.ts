import type { StorefrontEnv } from "./db";

/**
 * SMS seam for OTP delivery (mirrors the packages/core payments.ts adapter pattern: one
 * function owns each provider's wire format).
 * Providers, checked in order:
 *  - OTP_DEV_ECHO=1  → no SMS; the code is logged AND returned so dev/preview can complete the
 *    flow without a provider. NEVER set in production.
 *  - ThaiBulkSMS     → owner's chosen production provider (~฿0.25-0.35/msg, Thai sender name).
 *                      Set THAIBULKSMS_API_KEY (+ optional THAIBULKSMS_SENDER, default "AirPlus").
 *  - Twilio          → fallback, when TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM are set.
 */
export async function sendOtpSms(
  env: StorefrontEnv,
  phone: string,
  code: string,
): Promise<{ sent: boolean; devEcho?: string; error?: string }> {
  if (env.OTP_DEV_ECHO === "1") {
    console.log(`[auth] DEV OTP for ${phone}: ${code}`);
    return { sent: true, devEcho: code };
  }
  const body = `รหัส AirPlus: ${code} (ใช้ได้ 5 นาที)`;
  if (env.THAIBULKSMS_API_KEY) return sendViaThaiBulkSms(env, phone, body);
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM)
    return sendViaTwilio(env, phone, body);
  console.error("[auth] no SMS provider configured (set OTP_DEV_ECHO=1 for dev)");
  return { sent: false, error: "sms not configured" };
}

/**
 * ThaiBulkSMS wire format (thaibulksms.com public REST API v2):
 *   POST https://api-v2.thaibulksms.com/sms
 *   Basic auth: username = API key, password = API secret (both from the dashboard).
 *   Form fields: msisdn (comma-separated recipients), message, sender.
 *   Thai domestic numbers may be sent as 0XXXXXXXXX; the API accepts them directly.
 *   Response 200/201 = accepted; 400/401/402/429/5xx = rejected (message stays queued nowhere).
 */
async function sendViaThaiBulkSms(
  env: StorefrontEnv,
  phone: string,
  body: string,
): Promise<{ sent: boolean; error?: string }> {
  const sender = env.THAIBULKSMS_SENDER || "AirPlus";
  const auth = env.THAIBULKSMS_API_SECRET
    ? `Basic ${btoa(`${env.THAIBULKSMS_API_KEY}:${env.THAIBULKSMS_API_SECRET}`)}`
    : `Bearer ${env.THAIBULKSMS_API_KEY}`;
  try {
    const res = await fetch("https://api-v2.thaibulksms.com/sms", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ msisdn: phone, message: body, sender }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[auth] ThaiBulkSMS send failed: ${res.status} ${text.slice(0, 300)}`);
      return { sent: false, error: "sms provider rejected the message" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[auth] ThaiBulkSMS unreachable", err);
    return { sent: false, error: "sms provider unreachable" };
  }
}

async function sendViaTwilio(
  env: StorefrontEnv,
  phone: string,
  body: string,
): Promise<{ sent: boolean; error?: string }> {
  // Thai mobile 0XXXXXXXXX → E.164 +66XXXXXXXXX for Twilio (unlike ThaiBulkSMS).
  const to = phone.startsWith("0") ? `+66${phone.slice(1)}` : phone;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: env.TWILIO_FROM!, Body: body }),
      },
    );
    if (!res.ok) {
      console.error(`[auth] Twilio send failed: ${res.status} ${await res.text()}`);
      return { sent: false, error: "sms provider rejected the message" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[auth] Twilio unreachable", err);
    return { sent: false, error: "sms provider unreachable" };
  }
}

import { cookies } from "next/headers";
import { createSession, guardMutation, sessionCookieOptions } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/authCore";
import { getEnv } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { LINE_PENDING_COOKIE, takeLinePending } from "@/lib/lineAuth";
import { generateCustomerCode } from "@l-shopee/core";

/**
 * POST /api/auth/line/register — finish a first-time LINE signup. LINE is the only credential and
 * OTP is retired, so we never collect a login phone. But a customer row can't exist without a phone
 * (DB-enforced) and a Thai delivery address needs one anyway — so the phone is collected ONCE, as
 * part of a required delivery address, and used as both the account phone and the address's phone.
 * The verified LINE identity comes from the KV pending record set by /callback, never the body.
 */

const EXPIRED = "เซสชันหมดอายุ กรุณาเข้าสู่ระบบด้วย LINE อีกครั้ง";

interface DeliveryAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
}

/** The delivery address is required and must be complete — returns null on any missing/invalid field. */
function parseAddress(input: unknown): DeliveryAddress | null {
  if (typeof input !== "object" || input === null) return null;
  const a = input as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const phone = normalizePhone(str(a.phone));
  const addr: DeliveryAddress = {
    recipientName: str(a.recipientName),
    phone,
    addressLine1: str(a.addressLine1),
    subdistrict: str(a.subdistrict),
    district: str(a.district),
    province: str(a.province),
    postalCode: str(a.postalCode),
  };
  const ok =
    addr.recipientName &&
    phone.length >= 9 &&
    phone.length <= 10 &&
    addr.addressLine1 &&
    addr.subdistrict &&
    addr.district &&
    addr.province &&
    /^\d{5}$/.test(addr.postalCode);
  return ok ? addr : null;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const guarded = guardMutation(request);
    if (guarded) return guarded;

    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      pdpaConsent?: unknown;
      address?: unknown;
    } | null;

    const address = parseAddress(body?.address);
    if (!address)
      return Response.json(
        { error: "กรุณากรอกข้อมูลจัดส่งให้ครบ (เบอร์โทรและที่อยู่)" },
        { status: 400 },
      );
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

    // Username: the (editable) value the user confirmed, falling back to the LINE display name.
    const displayName =
      typeof body?.name === "string" && body.name.trim() ? body.name.trim() : pending.name;
    // The account phone IS the delivery phone — collected once.
    const phone = address.phone;

    const db = env.DB;
    const now = Date.now();

    // Idempotency: a double-submit / back-button may re-run this for a LINE id that already has an
    // account — just log that account in.
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
             (id, phone, name, customer_code, line_user_id, pdpa_consent_at, last_login_at,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          customerId,
          phone,
          displayName,
          generateCustomerCode(),
          pending.lineUserId,
          now,
          now,
          now,
          now,
        )
        .run();

      // The delivery address becomes their default (recipient = the account name + this phone).
      await db
        .prepare(
          `INSERT INTO addresses (id, storefront_customer_id, recipient_name, phone, address_line1,
             subdistrict, district, province, postal_code, is_default, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          customerId,
          address.recipientName,
          phone,
          address.addressLine1,
          address.subdistrict,
          address.district,
          address.province,
          address.postalCode,
          now,
        )
        .run();
    }

    const session = await createSession(db, customerId);
    cookieStore.set(SESSION_COOKIE, session.token, sessionCookieOptions());
    cookieStore.delete(LINE_PENDING_COOKIE);
    return Response.json({ customer: { id: customerId, phone, name: displayName } });
  } catch (err) {
    console.error("POST /api/auth/line/register failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

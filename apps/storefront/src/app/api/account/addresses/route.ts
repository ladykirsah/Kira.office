import { getSession, guardMutation } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { collapseToSingleDefault } from "@/lib/addresses";

export interface AddressRow {
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

const UNAUTH = Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

/** GET /api/account/addresses — the logged-in customer's address book (default first). */
export async function GET(): Promise<Response> {
  try {
    const customer = await getSession();
    if (!customer) return UNAUTH;
    const db = await getDb();
    const rows = await db
      .prepare(
        `SELECT id, recipient_name AS recipientName, phone, address_line1 AS addressLine1,
                subdistrict, district, province, postal_code AS postalCode, is_default AS isDefault
         FROM addresses WHERE storefront_customer_id = ?
         ORDER BY is_default DESC, created_at DESC LIMIT 20`,
      )
      .bind(customer.id)
      .all<Omit<AddressRow, "isDefault"> & { isDefault: number }>();
    // Rows come back default-first, newest-first. Legacy/seed data can carry more than one
    // is_default=1, so collapse to a single default (the latest wins) — the UI then never shows two
    // "ค่าเริ่มต้น" badges and checkout resolves one deterministic default.
    const addresses = collapseToSingleDefault(
      (rows.results ?? []).map((a) => ({ ...a, isDefault: Boolean(a.isDefault) })),
    );
    return Response.json({ addresses });
  } catch (err) {
    console.error("GET /api/account/addresses failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
  }
}

/** POST /api/account/addresses — add an address; the newest becomes the default (only one at a time). */
export async function POST(req: Request): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;
    const customer = await getSession();
    if (!customer) return UNAUTH;
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
    const now = Date.now();
    const id = crypto.randomUUID();
    // The newest address becomes the default — there is only ever one default (the clear-others UPDATE
    // below enforces that). A caller can opt out by explicitly sending isDefault:false.
    const makeDefault = b.isDefault !== false;
    const statements = [
      db
        .prepare(
          `INSERT INTO addresses (id, storefront_customer_id, recipient_name, phone, address_line1,
             subdistrict, district, province, postal_code, is_default, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          customer.id,
          recipientName,
          phone,
          addressLine1,
          subdistrict,
          district,
          province,
          postalCode,
          makeDefault ? 1 : 0,
          now,
        ),
    ];
    if (makeDefault)
      statements.unshift(
        db
          .prepare(`UPDATE addresses SET is_default = 0 WHERE storefront_customer_id = ?`)
          .bind(customer.id),
      );
    await db.batch(statements);
    return Response.json({ id, isDefault: makeDefault });
  } catch (err) {
    console.error("POST /api/account/addresses failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
  }
}

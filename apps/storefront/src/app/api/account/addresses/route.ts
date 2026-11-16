import { getSession, guardMutation } from "@/lib/auth";
import { hasOwnAddress, listOwnAddresses, type OwnAddress } from "@/lib/addressBook";
import { getDb } from "@/lib/db";

export type AddressRow = OwnAddress;

/** A new reply each time: one Response can be sent only once. */
const unauth = () => Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

/** GET /api/account/addresses — the logged-in customer's address book (default first). */
export async function GET(): Promise<Response> {
  try {
    const customer = await getSession();
    if (!customer) return unauth();
    return Response.json({ addresses: await listOwnAddresses(await getDb(), customer.id) });
  } catch (err) {
    console.error("GET /api/account/addresses failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
  }
}

/** POST /api/account/addresses — add an address (becomes default when it is the first). */
export async function POST(req: Request): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;
    const customer = await getSession();
    if (!customer) return unauth();
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
    // A first address the customer can see becomes the default (removed ones don't count).
    const makeDefault = b.isDefault === true || !(await hasOwnAddress(db, customer.id));
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

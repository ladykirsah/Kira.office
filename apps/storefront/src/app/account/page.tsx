import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/AccountNav";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** My-account hub: profile card + links to orders and address book + logout. */

function formatThaiPhone(digits: string): string {
  if (/^\d{10}$/.test(digits))
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (/^\d{9}$/.test(digits))
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  return digits;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m9 5 7 7-7 7"
        stroke="var(--text-faint)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function AccountPage() {
  const customer = await getSession();
  if (!customer) redirect("/login?next=/account");

  const db = await getDb();
  const meta = await db
    .prepare(`SELECT created_at AS createdAt FROM storefront_customers WHERE id = ?`)
    .bind(customer.id)
    .first<{ createdAt: number }>();

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="section">
        <h1 className="t-h1" style={{ margin: "0 0 4px" }}>
          บัญชีของฉัน
        </h1>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="t-h3">{formatThaiPhone(customer.phone)}</div>
        {customer.name ? (
          <div style={{ fontSize: 14, marginTop: 4 }}>{customer.name}</div>
        ) : (
          <div className="muted" style={{ marginTop: 4 }}>
            ยังไม่ได้ระบุชื่อ — ระบุตอนสั่งซื้อครั้งแรก
          </div>
        )}
        {meta?.createdAt && (
          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            เป็นสมาชิกตั้งแต่ {formatDate(meta.createdAt)}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <Link
          href="/account/orders"
          className="card t-h4"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
          }}
        >
          คำสั่งซื้อของฉัน
          <Chevron />
        </Link>
        <Link
          href="/account/addresses"
          className="card t-h4"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
          }}
        >
          ที่อยู่จัดส่ง
          <Chevron />
        </Link>
      </div>

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <LogoutButton />
      </div>
    </div>
  );
}

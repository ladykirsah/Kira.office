import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/AccountNav";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { LINE_OA_URL } from "@/lib/links";
import { Icon, type IconName } from "@/components/Icon";
import { ProfileCard } from "./ProfileCard";

export const dynamic = "force-dynamic";

/**
 * My-account hub ("Design 3" — friendly tiles): a personal greeting + member card, a 2×2 grid of
 * big icon tiles (orders/addresses with live counts, coupons, help-via-LINE), a slim shipping-info
 * row, and logout. All destinations are real routes; counts come from one D1 read.
 */

function formatDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function Tile({
  href,
  name,
  label,
  count,
  external,
}: {
  href: string;
  name: IconName;
  label: string;
  count?: number;
  external?: boolean;
}) {
  const body = (
    <>
      <span className="acct-tile-ic">
        <Icon name={name} size={22} />
      </span>
      <span className="acct-tile-l">{label}</span>
      {count != null && count > 0 && <span className="acct-tile-c">{count}</span>}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="acct-tile">
      {body}
    </a>
  ) : (
    <Link href={href} className="acct-tile">
      {body}
    </Link>
  );
}

export default async function AccountPage() {
  const customer = await getSession();
  if (!customer) redirect("/login?next=/account");

  const db = await getDb();
  const info = await db
    .prepare(
      `SELECT c.created_at AS createdAt, c.pdpa_consent_at AS pdpaConsentAt,
        (SELECT COUNT(*) FROM sales_orders o
         WHERE o.storefront_customer_id = c.id AND o.channel = 'airplus') AS orders,
        (SELECT COUNT(*) FROM addresses a WHERE a.storefront_customer_id = c.id) AS addresses
       FROM storefront_customers c WHERE c.id = ?`,
    )
    .bind(customer.id)
    .first<{
      createdAt: number;
      pdpaConsentAt: number | null;
      orders: number;
      addresses: number;
    }>();

  const firstName = customer.name ? customer.name.trim().split(/\s+/)[0] : "";

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="acct-greet">
        <h1>
          {firstName ? `สวัสดี, ${firstName} ` : "ยินดีต้อนรับ "}
          <span aria-hidden="true">👋</span>
        </h1>
        <p>
          {info?.createdAt
            ? `เป็นสมาชิก AirPlus ตั้งแต่ ${formatDate(info.createdAt)}`
            : "สมาชิก AirPlus"}
        </p>
      </div>

      {/* Replaces the old read-only phone strip. The greeting above needs a name we never asked
          for, and a name captured once at checkout could never be corrected — so the card that
          shows those two facts is also the place to fix them. */}
      <ProfileCard name={customer.name} phone={customer.phone} />

      <div className="acct-tiles">
        <Tile href="/account/orders" name="orders" label="คำสั่งซื้อ" count={info?.orders ?? 0} />
        <Tile
          href="/account/addresses"
          name="address"
          label="ที่อยู่จัดส่ง"
          count={info?.addresses ?? 0}
        />
        <Tile href="/account/coupons" name="coupon" label="คูปองของฉัน" />
        <Tile href={LINE_OA_URL} name="chat" label="ช่วยเหลือ" external />
      </div>

      <div className="acct-list">
        <Link href="/info" className="acct-row">
          <span className="ic">
            <Icon name="truck" size={22} />
          </span>
          <span className="l">การจัดส่ง &amp; ชำระเงิน</span>
          <Icon name="chevron" size={18} className="acct-chev" />
        </Link>
      </div>

      {/* PDPA consent receipt — every member accepted at sign-up, so we confirm it (with the date)
          and keep the policy + terms one tap away. */}
      <div className="acct-consent">
        <span className="ic" aria-hidden="true">
          <Icon name="check" size={18} />
        </span>
        <p>
          คุณได้ยอมรับ <Link href="/privacy">นโยบายความเป็นส่วนตัว (PDPA)</Link> และ{" "}
          <Link href="/terms">ข้อกำหนดการใช้งาน</Link> แล้ว
          {info?.pdpaConsentAt ? ` เมื่อวันที่ ${formatDate(info.pdpaConsentAt)}` : ""}
        </p>
      </div>

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <LogoutButton />
      </div>
    </div>
  );
}

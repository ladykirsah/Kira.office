import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AddressBook } from "./AddressBook";

export const dynamic = "force-dynamic";

/** Address book — server shell does the auth guard; the CRUD UI is fully client-side. */
export default async function AccountAddressesPage() {
  const customer = await getSession();
  if (!customer) redirect(`/login?next=${encodeURIComponent("/account/addresses")}`);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="section">
        <h1 className="t-h1" style={{ margin: "0 0 4px" }}>
          ที่อยู่จัดส่ง
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          จัดการที่อยู่สำหรับการจัดส่งสินค้า
        </p>
      </div>
      <AddressBook />
    </div>
  );
}

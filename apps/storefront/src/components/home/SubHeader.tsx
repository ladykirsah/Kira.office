"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cartCount, useCart } from "@/lib/cart";
import { Icon } from "@/components/Icon";

/** Sub-page bar (owner's pick B, 5 Nov 2026): the same grey as the page — ‹ back · title · search, cart. */
/** `tools={false}` leaves the right side empty (board 4 · ตะกร้า, ชำระเงิน). */
export function SubHeader({ title, tools = true }: { title: string; tools?: boolean }) {
  const router = useRouter();
  const count = cartCount(useCart());
  const back = () => (window.history.length > 1 ? router.back() : router.push("/"));
  return (
    <header className="sub-head">
      <button type="button" className="sub-head-btn" aria-label="กลับ" onClick={back}>
        <Icon name="back" size={22} />
      </button>
      <h1 className="sub-head-t">{title}</h1>
      <div className="sub-head-tools">
        {tools && (
          <>
            <Link href="/search" className="sub-head-btn" aria-label="ค้นหา">
              <Icon name="search" size={22} />
            </Link>
            <Link href="/cart" className="sub-head-btn" aria-label={`ตะกร้า (${count} ชิ้น)`}>
              <Icon name="cart" size={22} />
              {count > 0 && <span className="sub-head-badge">{count}</span>}
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

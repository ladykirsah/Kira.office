"use client";

import Link from "next/link";
import { cartCount, useCart } from "@/lib/cart";
import { LINE_OA_URL } from "@/lib/links";
import { Icon } from "@/components/Icon";

/**
 * Phone home header (board 1, owner's pick A, 5 Nov 2026): the real white AirPlus logo, chat (LINE) +
 * cart, and the search bar, on a red top that fades into the grey behind the รถของฉัน card. Not sticky
 * — the bottom bar carries the way around on the phone.
 */
export function PhoneHeader() {
  const count = cartCount(useCart());
  return (
    <header className="hm-head">
      <div className="hm-head-row">
        <Link href="/" aria-label="AirPlus หน้าแรก" className="hm-head-logo">
          <img src="/logo/airplus-logo-white.png" alt="AirPlus" height={34} />
        </Link>
        <div className="hm-head-tools">
          <a
            href={LINE_OA_URL}
            target="_blank"
            rel="noopener"
            aria-label="แชทกับช่าง"
            className="hm-head-btn"
          >
            <Icon name="chat" size={22} />
          </a>
          <Link href="/cart" aria-label={`ตะกร้า (${count} ชิ้น)`} className="hm-head-btn">
            <Icon name="cart" size={22} />
            {count > 0 && <span className="hm-head-badge">{count}</span>}
          </Link>
        </div>
      </div>
      <Link href="/search" role="search" aria-label="ค้นหาสินค้า" className="hm-head-search">
        <Icon name="search" size={20} />
        <span>ค้นหาด้วยรุ่นรถ หรือชื่ออะไหล่</span>
      </Link>
    </header>
  );
}

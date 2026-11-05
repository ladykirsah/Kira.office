"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cartCount, useCart } from "@/lib/cart";
import { tabForPath, type TabKey } from "@/lib/myCar";
import { Icon, type IconName } from "@/components/Icon";

const TABS: { key: TabKey | "cart"; href: string; icon: IconName; label: string }[] = [
  { key: "home", href: "/", icon: "home", label: "หน้าแรก" },
  { key: "cats", href: "/categories", icon: "grid", label: "หมวดหมู่" },
  { key: "track", href: "/orders", icon: "box", label: "ติดตาม" },
  { key: "cart", href: "/cart", icon: "cart", label: "ตะกร้า" },
  { key: "me", href: "/account", icon: "profile", label: "ฉัน" },
];

/**
 * Phone bottom bar = owner's pick C (5 Nov 2026): the tab you are on shows icon + name in a light-red
 * pill, the others their icon only; the cart icon carries the item count. Main pages only (หน้าแรก ·
 * หมวดหมู่ · ติดตาม · ฉัน) — pages with ‹ back have none. Computers never see it (CSS).
 */
export function TabBar() {
  const active = tabForPath(usePathname());
  const count = cartCount(useCart());
  if (!active) return null;
  return (
    <>
      <div className="tb-space" aria-hidden="true" />
      <nav className="tb" aria-label="เมนูหลัก">
        {TABS.map((t) => {
          const on = t.key === active;
          const badge =
            t.key === "cart" && count > 0 ? <span className="tb-badge">{count}</span> : null;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={on ? "tb-tab tb-tab--on" : "tb-tab"}
              aria-label={on ? undefined : t.label}
              aria-current={on ? "page" : undefined}
            >
              <span className="tb-ic">
                <Icon name={t.icon} size={on ? 22 : 24} />
                {badge}
              </span>
              {on && t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

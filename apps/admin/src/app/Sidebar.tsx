"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";

const GROUPS: { section: string; links: [string, string, string][] }[] = [
  {
    section: "Catalog",
    links: [
      ["/scan", "📷", "Scan here"],
      ["/products", "📦", "Products"],
      ["/products/new", "➕", "Add product"],
      ["/barcodes", "🏷️", "Barcodes"],
      ["/import", "⬆️", "Import"],
    ],
  },
  {
    section: "Sell",
    links: [
      ["/pos", "🛒", "Point of Sale"],
      ["/payment", "💸", "Payment"],
      ["/customers", "👥", "Customers"],
    ],
  },
  {
    section: "Inventory",
    links: [["/stock", "📊", "Stock movements"]],
  },
  {
    section: "Orders & money",
    links: [
      ["/orders", "🧾", "Orders"],
      ["/sales", "💰", "Sales"],
      ["/affiliate", "🤝", "Affiliate"],
    ],
  },
  {
    section: "Settings",
    links: [
      ["/settings/shop", "🏪", "Shop info"],
      // Warranty used to be its own entry; it now lives on the Product categories card here, so a
      // category is created complete (title + photo + warranty) in one place.
      ["/settings/attributes", "🧩", "Part attributes"],
      ["/settings/services", "🔧", "Service Setup"],
      ["/settings/car-fitment", "🚗", "Car fitment"],
      ["/settings/banners", "🖼️", "Banners"],
      ["/settings/coupons", "🎟️", "Coupons"],
      ["/settings/campaigns", "⚡", "Flash sales"],
      ["/settings/affiliate-items", "🤝", "Affiliate tools"],
      ["/terms", "📝", "Terms"],
    ],
  },
];

export function Sidebar() {
  const path = usePathname();
  // The most specific matching link wins, so a sub-route (/customers/1กก) highlights its parent
  // without also lighting up a shorter sibling (/products vs /products/new).
  const activeHref = GROUPS.flatMap((g) => g.links.map((l) => l[0]))
    .filter((h) => path === h || path.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav className="sidebar" aria-label="Main">
      <Link className="brand" href="/">
        Kira.office
      </Link>
      {GROUPS.map((g) => (
        <div key={g.section}>
          <div className="nav-section-label">{g.section}</div>
          {g.links.map(([href, icon, label]) => {
            const active = href === activeHref;
            return (
              <a
                key={href}
                href={href}
                className={active ? "nav-link active" : "nav-link"}
                aria-current={active ? "page" : undefined}
              >
                <span className="ico" aria-hidden>
                  {icon}
                </span>
                {label}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

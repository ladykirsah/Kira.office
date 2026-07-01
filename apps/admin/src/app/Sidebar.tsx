"use client";

import { usePathname } from "next/navigation";

const GROUPS: { section: string; links: [string, string, string][] }[] = [
  {
    section: "Catalog",
    links: [
      ["/products", "📦", "Products"],
      ["/products/new", "➕", "Add product"],
      ["/barcodes", "🏷️", "Barcodes"],
      ["/import", "⬆️", "Import"],
    ],
  },
  {
    section: "Sell",
    links: [["/pos", "🛒", "Point of Sale"]],
  },
  {
    section: "Orders & money",
    links: [
      ["/orders", "🧾", "Orders"],
      ["/sales", "💰", "Sales"],
    ],
  },
  {
    section: "Settings",
    links: [
      ["/settings/shop", "🏪", "Shop info"],
      ["/settings/attributes", "🧩", "Part attributes"],
      ["/settings/services", "🔧", "Service Setup"],
      ["/settings/car-fitment", "🚗", "Car fitment"],
      ["/terms", "📝", "Terms"],
    ],
  },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <nav className="sidebar" aria-label="Main">
      <a className="brand" href="/">
        Kira.office
      </a>
      {GROUPS.map((g) => (
        <div key={g.section}>
          <div className="nav-section-label">{g.section}</div>
          {g.links.map(([href, icon, label]) => {
            const active = path === href;
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

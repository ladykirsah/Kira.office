const SECTIONS: { href: string; icon: string; title: string; desc: string }[] = [
  { href: "/products", icon: "📦", title: "Products", desc: "Catalog, images, edit" },
  { href: "/pos", icon: "🛒", title: "POS", desc: "Barcode selling (works offline)" },
  { href: "/stock", icon: "📊", title: "Stock", desc: "On-hand & adjustments" },
  { href: "/sales", icon: "💰", title: "Sales", desc: "Revenue, profit, refunds" },
  { href: "/finance", icon: "📈", title: "Finance", desc: "Totals & VAT" },
  { href: "/orders", icon: "🧾", title: "Orders", desc: "Shopee CSV import" },
  { href: "/import", icon: "⬆️", title: "Import", desc: "Bulk catalog CSV" },
  { href: "/terms", icon: "📝", title: "Terms", desc: "Thai T&C editor" },
];

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <p className="muted">Welcome back. Pick a section to get started.</p>
      <div className="card-grid" style={{ marginTop: 18 }}>
        {SECTIONS.map((s) => (
          <a key={s.href} href={s.href} className="card">
            <div style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>
              {s.icon}
            </div>
            <div style={{ fontWeight: 600, marginTop: 10 }}>{s.title}</div>
            <div className="muted" style={{ fontSize: 14 }}>
              {s.desc}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}

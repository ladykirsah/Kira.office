import type { ReactNode } from "react";

export const metadata = {
  title: "Kira.office — Admin",
  description: "Shopee Thailand back office",
};

const linkStyle = { color: "#0b65c2", textDecoration: "none" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, color: "#222" }}>
        <header
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid #eee",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <strong>Kira.office</strong>
          <a style={linkStyle} href="/">
            Dashboard
          </a>
          <a style={linkStyle} href="/products">
            Products
          </a>
          <a style={linkStyle} href="/products/new">
            Add
          </a>
          <a style={linkStyle} href="/import">
            Import
          </a>
          <a style={linkStyle} href="/pricing">
            Pricing
          </a>
          <a style={linkStyle} href="/stock">
            Stock
          </a>
          <a style={linkStyle} href="/terms">
            Terms
          </a>
          <a style={linkStyle} href="/barcodes">
            Barcodes
          </a>
          <a style={linkStyle} href="/pos">
            POS
          </a>
          <a style={linkStyle} href="/sales">
            Sales
          </a>
        </header>
        <div style={{ padding: 20 }}>{children}</div>
      </body>
    </html>
  );
}

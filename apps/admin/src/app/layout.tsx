import "./globals.css";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export const metadata = {
  title: "Kira.office — Admin",
  description: "Shopee Thailand back office",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>
        <div className="app-shell">
          <Sidebar />
          <div className="main">
            <header className="topbar">
              <span className="muted">Shopee Thailand back office</span>
            </header>
            <div className="content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}

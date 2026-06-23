import "./globals.css";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

export const metadata = {
  title: "Kira.office — Admin",
  description: "Shopee Thailand back office",
};

// Apply the saved theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <div className="app-shell">
          <Sidebar />
          <div className="main">
            <header className="topbar">
              <span className="muted">Shopee Thailand back office</span>
              <ThemeToggle />
            </header>
            <div className="content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}

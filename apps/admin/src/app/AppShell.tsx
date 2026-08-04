"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { StaffRole } from "@l-shopee/core";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";
import { DevApiBanner } from "./DevApiBanner";

/**
 * The app frame — sidebar, top bar, content.
 *
 * `/login` renders WITHOUT it: a sign-in page framed by the menu you can't use yet would be both
 * confusing and a small information leak (the menu names every page the business has). A client
 * component reading the path is enough here, and avoids moving every page into a route group just
 * to give one page a different layout.
 */
export function AppShell({
  children,
  identity,
  role,
}: {
  children: ReactNode;
  identity?: ReactNode;
  /** Undefined until someone signs in — the shell is not rendered for them anyway. */
  role?: StaffRole;
}) {
  const bare = usePathname() === "/login";
  // Signed out (or on the login page) there is no menu to draw — and no role to draw it for.
  if (bare || !role) return <>{children}</>;

  return (
    <div className="app-shell">
      <Sidebar role={role} />
      <div className="main">
        <header className="topbar">
          <MobileNav role={role} />
          <span className="muted topbar-tagline">Den Air Service + AirPlus back office</span>
          {identity}
          <ThemeToggle />
        </header>
        <div className="content">
          <DevApiBanner />
          {children}
        </div>
      </div>
    </div>
  );
}

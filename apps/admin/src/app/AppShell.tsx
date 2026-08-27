"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StaffRole } from "@l-shopee/core";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { DevApiBanner } from "./DevApiBanner";
import { useT } from "./LangProvider";

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
  const t = useT();
  const bare = usePathname() === "/login";
  // Signed out (or on the login page) there is no menu to draw — and no role to draw it for.
  if (bare || !role) return <>{children}</>;

  return (
    <div className="app-shell">
      <Sidebar role={role} />
      <div className="main">
        <header className="topbar">
          {/*
            ROW ONE ON A PHONE — the shop's name, alone on its own line.

            It used to be pinned to the CENTRE of a single-line bar and taken out of the flow, so
            nothing reserved any space for it and the staff chip was painted straight over the top:
            125px of overlap at 375px, with only the tail of the word showing (owner, 27 Aug 2026).
            Giving it a row of its own is the repair — after this it occupies space, so nothing can
            be drawn over it at any width.

            Hidden on a wide screen, where the sidebar carries the name instead.
          */}
          <Link className="mnav-brand" href="/">
            Kira.office
          </Link>
          {/*
            ROW TWO. A wrapper only so the phone can pin THIS row while the name above it scrolls
            away (owner's choice). On a wide screen it is `display: contents` — the element stops
            existing as far as layout is concerned, and its children sit in the bar exactly as they
            always have.
          */}
          <div className="topbar-row">
            <MobileNav role={role} />
            <span className="muted topbar-tagline">
              {t({
                th: "ระบบหลังร้าน Den Air Service + AirPlus",
                en: "Den Air Service + AirPlus back office",
              })}
            </span>
            {identity}
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>
        <div className="content">
          <DevApiBanner />
          {children}
        </div>
      </div>
    </div>
  );
}

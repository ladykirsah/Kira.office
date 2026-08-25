"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { navGroupsFor, PRIMARY_TABS, activeHref, nextBarVisible } from "./nav";
import type { StaffRole } from "@l-shopee/core";
import { useT } from "./LangProvider";

/** Menu glyph: a list — a dot and a line per row, i.e. the pages behind it. */
const MenuIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="4.5" cy="7" r="1.2" fill="currentColor" stroke="none" />
    <path d="M9 7h11" />
    <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <path d="M9 12h11" />
    <circle cx="4.5" cy="17" r="1.2" fill="currentColor" stroke="none" />
    <path d="M9 17h11" />
  </svg>
);

/**
 * The phone navigation (hidden by CSS above 741px, where the sidebar takes over):
 *
 *   · a bottom bar with the four daily pages — no "More"; ☰ is how you reach the rest
 *   · ☰ in the top bar, which slides the full grouped menu over the page
 *   · the bar slides away while scrolling down a long list and returns on the way up
 */
export function MobileNav({ role }: { role: StaffRole }) {
  const say = useT();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [barVisible, setBarVisible] = useState(true);
  const scroll = useRef({ y: 0, visible: true });
  const active = activeHref(path);
  const groups = navGroupsFor(role);

  // Any navigation closes the drawer — otherwise it would stay over the page you just opened.
  useEffect(() => setOpen(false), [path]);

  // Don't let the page scroll underneath the open drawer.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const visible = nextBarVisible(scroll.current, y);
      scroll.current = { y, visible };
      setBarVisible(visible);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes the drawer, like every other overlay in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="mnav-burger"
        aria-label={say({ th: "เปิดเมนู", en: "Open menu" })}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </button>
      <Link className="mnav-brand" href="/">
        Kira.office
      </Link>

      {open && (
        <>
          <div className="mnav-scrim" onClick={() => setOpen(false)} aria-hidden />
          <nav className="mnav-drawer" aria-label={say({ th: "เมนูหลัก", en: "Main" })}>
            <Link className="brand" href="/" onClick={() => setOpen(false)}>
              Kira.office
            </Link>
            {groups.map((g) => (
              <div key={g.section.en}>
                <div className="nav-section-label">{say(g.section)}</div>
                {g.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className={l.href === active ? "nav-link active" : "nav-link"}
                    aria-current={l.href === active ? "page" : undefined}
                  >
                    <span className="ico" aria-hidden>
                      {l.icon}
                    </span>
                    {say(l.label)}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </>
      )}

      <nav
        className={barVisible ? "mnav-tabs" : "mnav-tabs hidden"}
        aria-label={say({ th: "เมนูลัด", en: "Quick access" })}
        aria-hidden={!barVisible}
      >
        {PRIMARY_TABS.map((t) => (
          <a
            key={t.href}
            href={t.href}
            className={t.href === active ? "mnav-tab active" : "mnav-tab"}
            aria-current={t.href === active ? "page" : undefined}
            tabIndex={barVisible ? undefined : -1}
          >
            <span className="em" aria-hidden>
              {t.icon}
            </span>
            {say(t.short ?? t.label)}
          </a>
        ))}
      </nav>
    </>
  );
}

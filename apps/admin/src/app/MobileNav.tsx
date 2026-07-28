"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NAV_GROUPS, PRIMARY_TABS, activeHref, nextBarVisible, pageTitle } from "./nav";

/**
 * The phone navigation (hidden by CSS above 741px, where the sidebar takes over):
 *
 *   · a bottom bar with the four daily pages — no "More"; ☰ is how you reach the rest
 *   · ☰ in the top bar, which slides the full grouped menu over the page
 *   · the bar slides away while scrolling down a long list and returns on the way up
 */
export function MobileNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [barVisible, setBarVisible] = useState(true);
  const scroll = useRef({ y: 0, visible: true });
  const active = activeHref(path);

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
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden />
        <span aria-hidden />
        <span aria-hidden />
      </button>
      <span className="mnav-title">{pageTitle(path)}</span>

      {open && (
        <>
          <div className="mnav-scrim" onClick={() => setOpen(false)} aria-hidden />
          <nav className="mnav-drawer" aria-label="Main">
            <Link className="brand" href="/" onClick={() => setOpen(false)}>
              Kira.office
            </Link>
            {NAV_GROUPS.map((g) => (
              <div key={g.section}>
                <div className="nav-section-label">{g.section}</div>
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
                    {l.label}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </>
      )}

      <nav
        className={barVisible ? "mnav-tabs" : "mnav-tabs hidden"}
        aria-label="Quick access"
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
            {t.short ?? t.label}
          </a>
        ))}
      </nav>
    </>
  );
}

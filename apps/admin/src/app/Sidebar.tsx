"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, activeHref } from "./nav";

/** Desktop navigation. Below 742px CSS hides this and <MobileNav> takes over. */
export function Sidebar() {
  const path = usePathname();
  const active = activeHref(path);
  return (
    <nav className="sidebar" aria-label="Main">
      <Link className="brand" href="/">
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
  );
}

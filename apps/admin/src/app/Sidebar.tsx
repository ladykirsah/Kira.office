"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navGroupsFor, activeHref } from "./nav";
import type { StaffRole } from "@l-shopee/core";
import { useT } from "./LangProvider";

/** Desktop navigation. Below 742px CSS hides this and <MobileNav> takes over. */
export function Sidebar({ role }: { role: StaffRole }) {
  const t = useT();
  const path = usePathname();
  const active = activeHref(path);
  const groups = navGroupsFor(role);
  return (
    <nav className="sidebar" aria-label={t({ th: "เมนูหลัก", en: "Main" })}>
      <Link className="brand" href="/">
        Kira.office
      </Link>
      {groups.map((g) => (
        <div key={g.section.en}>
          <div className="nav-section-label">{t(g.section)}</div>
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
              {t(l.label)}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

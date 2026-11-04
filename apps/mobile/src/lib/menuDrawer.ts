import { activeHref, navGroupsFor, type NavGroup } from "@l-shopee/shared/nav";
import type { StaffRole } from "./signIn";

/**
 * What the phone's ☰ menu lists (owner picked design C, 4 Nov 2026): หน้าหลัก on a row of its own —
 * before, the only way back was a tap on the word CrewEngine — then the role's pages in their four
 * sections, with the page you are on lit.
 */
export interface DrawerLink {
  href: string;
  label: NavGroup["links"][number]["label"];
  on: boolean;
}

export interface Drawer {
  home: { on: boolean };
  groups: { section: NavGroup["section"]; links: DrawerLink[] }[];
}

export function drawerFor(role: StaffRole, path: string): Drawer {
  const active = activeHref(path);
  return {
    home: { on: path === "/" },
    groups: navGroupsFor(role).map((g) => ({
      section: g.section,
      links: g.links.map((l) => ({ href: l.href, label: l.label, on: l.href === active })),
    })),
  };
}

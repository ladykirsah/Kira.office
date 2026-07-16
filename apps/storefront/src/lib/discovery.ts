// Helpers + data for the public agent-discovery surfaces (/llms.txt, /sitemap.md, /skills.md,
// /rss.xml, /sitemap.xml). These files describe AirPlus to AI agents and crawlers. Product names
// come from user/admin data, so anything placed inside XML must be escaped.

const XML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Escape the five XML special characters so catalog text is safe inside RSS/sitemap XML. */
export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => XML_ENTITIES[c]);
}

export interface CorePage {
  path: string;
  /** bilingual label (EN + Thai) for the discovery index */
  title: string;
}

/**
 * The PUBLIC pages advertised in the discovery surfaces. Only browse/marketing routes — never
 * authenticated (/account/*) or transient (/cart, /checkout) pages, so discovery never points bots
 * or agents at private surfaces. The `discovery > core pages exclude authed/transient` test enforces
 * this.
 */
export const CORE_PAGES: CorePage[] = [
  { path: "/", title: "Home (หน้าแรก)" },
  { path: "/products", title: "All products (สินค้าทั้งหมด)" },
  { path: "/categories", title: "Categories (หมวดหมู่อะไหล่)" },
  { path: "/brands", title: "Car brands (ยี่ห้อรถ)" },
  { path: "/search", title: "Search by car or part (ค้นหา)" },
  { path: "/coupons", title: "Coupons (คูปอง)" },
  { path: "/tools", title: "Mechanic tools — partner (เครื่องมือช่าง)" },
  { path: "/info", title: "Shipping & payment (การจัดส่ง & ชำระเงิน)" },
  { path: "/orders", title: "Track an order (ติดตามคำสั่งซื้อ)" },
  { path: "/privacy", title: "Privacy policy (PDPA)" },
  { path: "/login", title: "Login / register (เข้าสู่ระบบ / สมัครสมาชิก)" },
];

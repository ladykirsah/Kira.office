/**
 * The product page's คำอธิบาย: the product's own text, one empty line, then its category's text
 * (set in Kira's ตั้งค่าอะไหล่). Owner, 3 Nov 2026: "can we have 2 places > shown as one paragraph
 * on AirPlus". Either part may be missing; with neither the page shows no description block.
 */
export function joinDescriptions(own: string | null, category: string | null): string | null {
  const parts = [own, category].map((t) => t?.trim() ?? "").filter((t) => t !== "");
  return parts.length > 0 ? parts.join("\n\n") : null;
}

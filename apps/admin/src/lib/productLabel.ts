/** A product line's display label: "name · brand", or just the name when there's no brand. */
export function productDisplayName(name: string, brand?: string | null): string {
  const b = brand?.trim();
  return b ? `${name} · ${b}` : name;
}

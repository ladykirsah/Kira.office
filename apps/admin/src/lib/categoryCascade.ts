import type { Attributes, AttrOption } from "./api";

/**
 * Add-product cascade helpers. Product categories ("Part name" = product_types) are a subset of Car
 * systems (usage_categories), linked by product_types.usage_id (migration 0064): choosing a car
 * system filters the Part-name list, and choosing a Part name auto-fills its car system. Keeping the
 * logic here (pure, tested) lets PartDetails stay a thin wiring layer.
 *
 * Guiding rules:
 *  - Never show a mystery-empty Part-name list: with no/unknown system selected, show ALL categories.
 *  - A free-typed (not-yet-existing) category is never treated as "belonging elsewhere" — on save it
 *    inherits whatever car system is selected, so we keep it rather than clearing/overriding.
 */

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const byName = (opts: AttrOption[], name: string): AttrOption | undefined =>
  opts.find((o) => norm(o.name) === norm(name));

/** The car-system id a system NAME maps to. null when the name is empty or not a known system. */
export function carSystemIdByName(attributes: Attributes | null, usageName: string): string | null {
  if (!attributes || !norm(usageName)) return null;
  return byName(attributes.usages, usageName)?.id ?? null;
}

/**
 * Category (Part-name) options to show for the chosen car system. A known system → only its
 * categories; no/unknown system → all categories (so the field is never inexplicably empty).
 */
export function categoryNamesForSystem(attributes: Attributes | null, usageName: string): string[] {
  if (!attributes) return [];
  const systemId = carSystemIdByName(attributes, usageName);
  const types = systemId
    ? attributes.types.filter((t) => t.usageId === systemId)
    : attributes.types;
  return types.map((t) => t.name);
}

/** The car-system NAME a category belongs to (for reverse auto-fill). null when unknown/unlinked. */
export function systemForCategory(attributes: Attributes | null, typeName: string): string | null {
  if (!attributes || !norm(typeName)) return null;
  const type = byName(attributes.types, typeName);
  if (!type?.usageId) return null;
  return attributes.usages.find((u) => u.id === type.usageId)?.name ?? null;
}

/**
 * Patch for changing the car system: keep a still-valid Part name, clear one that belongs to a
 * different known system. A free-typed / unlinked Part name is kept (it inherits the new system).
 */
export function systemChangePatch(
  attributes: Attributes | null,
  newUsage: string,
  currentType: string,
): { usage: string; type?: string } {
  const base = { usage: newUsage };
  const systemId = carSystemIdByName(attributes, newUsage);
  if (!systemId || !attributes || !norm(currentType)) return base;
  const cat = byName(attributes.types, currentType);
  if (cat?.usageId && cat.usageId !== systemId) return { usage: newUsage, type: "" };
  return base;
}

/**
 * Patch for picking a Part name: set it, and auto-fill/switch the car system to the one it belongs
 * to. A free-typed / unlinked Part name leaves the car system as-is (it inherits it on save).
 */
export function categoryPickPatch(
  attributes: Attributes | null,
  newType: string,
  currentUsage: string,
): { type: string; usage?: string } {
  const base = { type: newType };
  const catSystemName = systemForCategory(attributes, newType);
  if (!catSystemName) return base;
  const catSystemId = carSystemIdByName(attributes, catSystemName);
  const currentSystemId = carSystemIdByName(attributes, currentUsage);
  if (currentSystemId !== catSystemId) return { type: newType, usage: catSystemName };
  return base;
}

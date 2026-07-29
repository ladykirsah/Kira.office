/**
 * POS writes a customer's car as plain text ("Toyota Vigo 2012" — brand, model, year, the same
 * label printed on the bill). This reads that text back against the car-fitment tree so a returning
 * plate can prefill the Vehicle selects. Anything it can't recognise simply doesn't prefill.
 */

interface BrandLike {
  id: string;
  name: string;
  models: { id: string; name: string }[];
}

export interface SavedCar {
  brandId: string;
  /** Empty when the tree has no model by that name (the car was typed elsewhere, or renamed). */
  modelId: string;
  /** Empty when no year was saved. */
  year: string;
}

export function parseSavedCar(
  saved: string | null | undefined,
  brands: BrandLike[],
): SavedCar | null {
  const text = (saved ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  const lower = text.toLowerCase();

  // Longest brand name first, so "Mercedes Benz" wins over a hypothetical "Mercedes".
  const brand = [...brands]
    .sort((a, b) => b.name.length - a.name.length)
    .find((b) => lower === b.name.toLowerCase() || lower.startsWith(`${b.name.toLowerCase()} `));
  if (!brand) return null;

  let rest = text.slice(brand.name.length).trim();
  const yearMatch = rest.match(/(?:^|\s)(\d{4})$/);
  const year = yearMatch ? yearMatch[1] : "";
  if (yearMatch) rest = rest.slice(0, rest.length - yearMatch[0].length).trim();

  const model = brand.models.find((m) => m.name.toLowerCase() === rest.toLowerCase());
  return { brandId: brand.id, modelId: model?.id ?? "", year };
}

import type { Buyer } from "./scanSale";

/** What a bill line needs to name a part; an old line may have only its name. */
export interface BillNameParts {
  name: string;
  typeName?: string | null;
  brandName?: string | null;
  carModel?: string | null;
}

const clean = (s: string | null | undefined): string => (s ?? "").trim();

/**
 * The name a bill line prints (owner, 4 Nov 2026): a customer's bill reads "[type] [brand]"; a mechanic's (B2B) bill
 * adds the top car model from the part's ใช้ได้กับรถ list. A part with no type keeps its full name, so a line is never
 * just a brand.
 */
/** The printed bill names a size in words after the part: "โอริง DENSO 1/2 กลาง" (11 Nov 2026). */
export const withSize = (name: string, size: string | null | undefined): string =>
  clean(size) ? `${name} ${clean(size)}` : name;

export function billLineName(p: BillNameParts, buyer: Buyer): string {
  const type = clean(p.typeName);
  if (!type) return p.name;
  const car = buyer === "mechanic" ? clean(p.carModel) : "";
  return [type, clean(p.brandName), car].filter(Boolean).join(" ");
}

/** The top car model of a part's ใช้ได้กับรถ list (already in list order), or null when it fits no car. */
export function firstCarModel(
  fitments: readonly { carModel?: string | null }[] | null | undefined,
): string | null {
  return clean(fitments?.[0]?.carModel) || null;
}

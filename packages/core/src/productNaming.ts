/**
 * Composes a product's name from the fields already captured on the product form, so a catalogue
 * listed over many sittings reads consistently — and so the name carries the words buyers actually
 * search: the Thai part type first, then the cars it fits, then the brand and the code.
 *
 * Shape (owner's pattern, 2026-07-23):
 *   {Thai part type} {1st fitment in English} / {2nd in Thai} / {3rd in Thai} | {brand} {code}
 *   ตู้แอร์ คอยล์เย็น Toyota Vigo / ฟอร์จูนเนอร์ / อัลติส | Denso TG447610-7290
 *
 * The first fitment stays roman because that is the form the car brand is written in; the rest use
 * the Thai model name so the title matches Thai queries. Everything degrades rather than breaking:
 * a missing Thai name falls back to the roman one, a missing brand drops its slot entirely.
 */

export interface ProductNameFitment {
  /** Car brand, roman — e.g. "Toyota". Only used for the first fitment. */
  carBrand: string | null;
  /** Car model, roman — e.g. "Vigo". */
  carModel: string | null;
  /** Car model in Thai — e.g. "วีโก้". Falls back to carModel when absent. */
  carModelTh?: string | null;
}

export interface ProductNameInput {
  /** Part type in Thai — e.g. "ตู้แอร์ คอยล์เย็น". */
  typeNameTh: string | null;
  /** Fitments in display order; only the first three are used. */
  fitments: ProductNameFitment[];
  /** Part brand, roman — e.g. "Denso". */
  brandName: string | null;
  /** The product code shown to buyers. */
  productRef: string | null;
}

/** How many fitments the name carries before the rest are left to the fitment table. */
export const NAME_FITMENT_LIMIT = 3;

const clean = (v: string | null | undefined): string => (v ?? "").trim();

/** One fitment as it appears in the name. The first keeps its car brand; later ones are Thai-only. */
function fitmentLabel(f: ProductNameFitment, isFirst: boolean): string {
  const model = isFirst ? clean(f.carModel) : clean(f.carModelTh) || clean(f.carModel);
  if (!model) return "";
  const brand = isFirst ? clean(f.carBrand) : "";
  return brand ? `${brand} ${model}` : model;
}

/**
 * True once there is enough to compose a name worth applying. Brand is deliberately NOT required —
 * plenty of parts are unbranded, and the name still reads correctly without that slot.
 */
export function canBuildProductName(input: ProductNameInput): boolean {
  return (
    clean(input.typeNameTh) !== "" &&
    clean(input.productRef) !== "" &&
    input.fitments.some((f) => clean(f.carModel) !== "" || clean(f.carModelTh) !== "")
  );
}

export function buildProductName(input: ProductNameInput): string {
  const type = clean(input.typeNameTh);
  const cars = input.fitments
    .slice(0, NAME_FITMENT_LIMIT)
    .map((f, i) => fitmentLabel(f, i === 0))
    .filter((s) => s !== "")
    .join(" / ");

  // Brand and code share the tail slot; either alone still renders without a stray separator.
  const tail = [clean(input.brandName), clean(input.productRef)].filter((s) => s !== "").join(" ");

  const head = [type, cars].filter((s) => s !== "").join(" ");
  return [head, tail].filter((s) => s !== "").join(" | ");
}

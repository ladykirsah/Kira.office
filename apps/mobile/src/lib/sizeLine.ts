/**
 * A size on a row: its value as a grey tag in front of ITS OWN code (owner's pick A, 11 Nov 2026,
 * "[1/2 กลาง] TG949142-00204D ⧉"), so a two-line name never pushes the size out of view. Rows of a
 * product without sizes keep the product's code and no tag. No screen code here.
 */
export interface SizeCode {
  tag: string | null;
  code: string | null;
}

const clean = (s: string | null | undefined): string => (s ?? "").trim();

export function sizeCode(p: {
  choiceValue?: string | null;
  choiceCode?: string | null;
  productRef?: string | null;
}): SizeCode {
  const tag = clean(p.choiceValue) || null;
  const own = tag ? clean(p.choiceCode) : "";
  return { tag, code: own || clean(p.productRef) || null };
}

/** The same for a row of the per-size product list (GET /products?by=variant). */
export const rowSizeCode = (r: {
  optionValue?: string | null;
  code?: string | null;
  productRef: string | null;
}): SizeCode =>
  sizeCode({ choiceValue: r.optionValue, choiceCode: r.code, productRef: r.productRef });

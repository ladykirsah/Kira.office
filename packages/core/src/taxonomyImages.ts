/**
 * Cover images for taxonomy rows (product types = storefront categories, car brands). They share
 * one R2 namespace, `taxonomy/`, which the api Worker's public GET /img/:key route must allow —
 * a key outside the allow-listed namespaces 404s, so keep the two in sync.
 */

export type TaxonomyImageKind = "type" | "car-brand";

/** Table each kind's cover image column lives on. */
export const TAXONOMY_IMAGE_TABLE: Record<TaxonomyImageKind, string> = {
  type: "product_types",
  "car-brand": "car_brands",
};

/**
 * R2 key for a taxonomy cover image. Includes a uuid so replacing an image writes a NEW key —
 * cached <img> URLs of the old cover can't show the new picture (and vice versa).
 */
export function taxonomyImageKey(
  kind: TaxonomyImageKind,
  id: string,
  ext: string,
  uuid: string,
): string {
  return `taxonomy/${kind}-${id}-${uuid}.${ext}`;
}

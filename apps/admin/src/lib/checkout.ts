/**
 * Build the customer-enrichment upsert to fire after a POS checkout, so the plate's province (typed
 * at POS) lands on the plate-keyed customer record. Returns null when there's nothing worth saving —
 * no plate to key on, or no province entered — so we don't create an empty enrichment row.
 */
export function buildCheckoutCustomerUpsert(input: {
  plate: string;
  province: string;
}): { licensePlate: string; plateProvince: string } | null {
  const licensePlate = input.plate.trim();
  const plateProvince = input.province.trim();
  if (!licensePlate || !plateProvince) return null;
  return { licensePlate, plateProvince };
}

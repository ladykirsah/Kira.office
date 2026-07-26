/**
 * What a new product must have before it can be created/saved. Both fields are checked together and
 * reported in one message, so the admin is never marched through them in a fixed order — they can
 * fill name and Product ID (and everything else) first or last, in any order.
 */
export function missingRequiredToSave(fields: { name: string; productRef: string }): string | null {
  const missing: string[] = [];
  if (!fields.name.trim()) missing.push("a product name");
  if (!fields.productRef.trim()) missing.push("a Product ID");
  if (missing.length === 0) return null;
  return `Enter ${missing.join(" and ")} to save.`;
}

/**
 * Whether the Add page should background-save the in-progress product as a draft right now. Guards:
 *  - both required fields present (else there's nothing to save);
 *  - something actually changed since the last saved draft (no redundant writes);
 *  - the FIRST save must not land on a Product ID that already belongs to another product — that
 *    would recover/clobber it. Once we own a draft row (hasAutosavedId), later saves target it by
 *    id, so a matching Product ID is just our own draft and is fine.
 */
export function shouldAutosaveDraft(args: {
  busy: boolean;
  name: string;
  productRef: string;
  hasAutosavedId: boolean;
  refInUse: boolean;
  signature: string;
  lastSavedSignature: string;
}): boolean {
  if (args.busy) return false;
  if (missingRequiredToSave({ name: args.name, productRef: args.productRef })) return false;
  if (args.signature === args.lastSavedSignature) return false;
  if (!args.hasAutosavedId && args.refInUse) return false;
  return true;
}

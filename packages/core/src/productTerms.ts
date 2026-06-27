import { findMissingPlaceholders, renderTerms } from "./terms";
import type { AppRole } from "./rbac";

/** Product + shop fields that fill Thai T&C placeholders (see docs/PRODUCT_TERMS_PATTERNS.md). */
export interface ProductTermsSource {
  productName: string;
  brand?: string;
  productType?: string;
  usageCategory?: string;
  includedItems?: string;
  warrantyDays?: string;
  returnDays?: string;
  safetyWarnings?: string;
  careInstructions?: string;
  expiryDate?: string;
  countryOfOrigin?: string;
  sellerName?: string;
}

export type ProductTermsStatus = "draft" | "approved" | "published";

/** Map catalog fields to template placeholder keys. Empty string when a field is absent. */
export function buildTermsVars(source: ProductTermsSource): Record<string, string> {
  return {
    product_name: source.productName,
    brand: source.brand ?? "",
    product_type: source.productType ?? "",
    usage_category: source.usageCategory ?? "",
    included_items: source.includedItems ?? "",
    warranty_days: source.warrantyDays ?? "",
    return_days: source.returnDays ?? "",
    safety_warnings: source.safetyWarnings ?? "",
    care_instructions: source.careInstructions ?? "",
    expiry_date: source.expiryDate ?? "",
    country_of_origin: source.countryOfOrigin ?? "",
    seller_name: source.sellerName ?? "",
  };
}

export interface GenerateProductTermsResult {
  body: string;
  missingPlaceholders: string[];
  canPublish: boolean;
}

/** Render a pattern against product fields; block publish when placeholders are unfilled. */
export function generateProductTerms(
  template: string,
  source: ProductTermsSource,
): GenerateProductTermsResult {
  const vars = buildTermsVars(source);
  const missingPlaceholders = findMissingPlaceholders(template, vars);
  return {
    body: renderTerms(template, vars),
    missingPlaceholders,
    canPublish: missingPlaceholders.length === 0,
  };
}

/** Status transitions for the generate → approve → publish flow (owner/manager approve). */
export function canTransitionTermsStatus(
  from: ProductTermsStatus,
  to: ProductTermsStatus,
  role: AppRole,
): boolean {
  if (from === to) return true;
  const canApprove = role === "owner" || role === "manager";
  switch (to) {
    case "draft":
      return canApprove;
    case "approved":
      return canApprove && from === "draft";
    case "published":
      return canApprove && from === "approved";
    default: {
      const _exhaustive: never = to;
      return _exhaustive;
    }
  }
}

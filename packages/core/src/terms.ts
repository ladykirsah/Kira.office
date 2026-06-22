/**
 * Fill `{{placeholder}}` tokens from `vars`. Whitespace inside braces is allowed.
 * Unknown placeholders are left untouched so missing data is visible for review.
 */
export function renderTerms(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? (vars[key] as string) : match,
  );
}

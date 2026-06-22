/**
 * Fill `{{placeholder}}` tokens from `vars`. Whitespace inside braces is allowed.
 * Unknown placeholders are left untouched so missing data is visible for review.
 */
export function renderTerms(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? (vars[key] as string) : match,
  );
}

/** Unique placeholder names in a template, in first-seen order. */
export function extractPlaceholders(template: string): string[] {
  const names: string[] = [];
  for (const match of template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    const name = match[1];
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * Placeholders a template needs but `vars` does not satisfy (absent or empty). Used to block
 * publishing terms with unfilled fields.
 */
export function findMissingPlaceholders(template: string, vars: Record<string, string>): string[] {
  return extractPlaceholders(template).filter(
    (name) => !Object.prototype.hasOwnProperty.call(vars, name) || vars[name] === "",
  );
}

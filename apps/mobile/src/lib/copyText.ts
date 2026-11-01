/**
 * Puts a code on the clipboard and says whether it got there. A browser may refuse (no permission),
 * and a phone build has no web clipboard; either way the caller shows no "copied" for it.
 */
export async function copyText(text: string): Promise<boolean> {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

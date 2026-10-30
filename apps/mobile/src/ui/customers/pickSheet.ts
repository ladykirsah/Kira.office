/**
 * Choosing a file in the phone app needs a document-picker module the app does not carry yet (web
 * first, owner 2026-10-26). Until then the app answers "nothing chosen" and the sheet says to use
 * the web.
 */
export async function pickSheet(): Promise<File | null> {
  return null;
}

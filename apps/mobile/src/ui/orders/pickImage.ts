/**
 * Choosing a slip photo in the phone app needs a photo-picker module the app does not carry yet
 * (web first, owner 2026-10-26). Until then the app answers "nothing chosen" and the screen says to
 * use the web.
 */
export async function pickImage(): Promise<Blob | null> {
  return null;
}

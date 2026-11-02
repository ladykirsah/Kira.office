/**
 * Saving a picture to the phone needs a module the app does not carry yet (web first, owner
 * 2026-10-26). Until then the button says so instead of doing nothing.
 */
export async function saveImage(_uri: string, _fileName: string): Promise<void> {
  throw new Error("Saving pictures works in the web version for now");
}

/**
 * The phone app has no photo-picker module yet (web first, owner 2026-10-26), so it answers
 * "nothing chosen" and the page says to add photos from the web for now.
 */
export async function pickPhoto(_source: "camera" | "library"): Promise<Blob | null> {
  return null;
}

export function photoPreview(_photo: Blob): string {
  return "";
}

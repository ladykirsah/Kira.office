/**
 * A local photo buffer for the Add-product page: photos picked before the product exists are held in
 * the browser (as object-URL previews) and uploaded on Save, so photos can be added first or last —
 * no fixed order, no product created just to hold an image.
 */
export interface BufferPhoto {
  id: string;
  file: File;
  url: string; // object URL for preview; revoked when removed/uploaded
}

/** Append to the buffer, never exceeding the frame limit (returns the same list unchanged when full). */
export function addToBuffer(
  current: BufferPhoto[],
  photo: BufferPhoto,
  max: number,
): BufferPhoto[] {
  if (current.length >= max) return current;
  return [...current, photo];
}

/** Upload buffered files in order via `upload`, returning how many were uploaded. Throws on the first
 *  failure so Save surfaces it (the product row already exists; remaining photos can be retried). */
export async function uploadBufferInOrder(
  files: File[],
  upload: (file: File) => Promise<unknown>,
): Promise<number> {
  let uploaded = 0;
  for (const file of files) {
    await upload(file);
    uploaded++;
  }
  return uploaded;
}

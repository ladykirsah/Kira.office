"use client";

import { COVER_MAX_PX, centredSquareCrop } from "./squareCrop";

/**
 * Re-encode a picked image as a centred 1:1 square, at most COVER_MAX_PX per side.
 *
 * Runs in the browser before upload so the stored object is already square — the
 * storefront tiles are all 1:1 with `object-fit: cover`, so an oblong upload would
 * otherwise be cropped at display time with the owner never seeing which edges were
 * lost. Also caps a multi-megabyte phone photo down to a sensible cover size.
 *
 * Output is always PNG or JPEG (never the exotic source type), because the API's
 * validateImage only accepts jpeg/png/webp. A source with transparency keeps PNG;
 * everything else becomes JPEG to keep photos small.
 *
 * Falls back to the ORIGINAL file if anything in the canvas path fails (no
 * OffscreenCanvas, a decode error, a tainted canvas). A slightly-wrong aspect ratio
 * is a much better outcome than a cover picker that refuses to upload.
 */
export async function toSquareCover(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const { sx, sy, side, out } = centredSquareCrop(bitmap.width, bitmap.height, COVER_MAX_PX);
    if (side <= 0 || out <= 0) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
    bitmap.close();

    const keepAlpha = file.type === "image/png" || file.type === "image/webp";
    const mime = keepAlpha ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, keepAlpha ? undefined : 0.9),
    );
    if (!blob) return file;

    const ext = mime === "image/png" ? "png" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "cover";
    return new File([blob], `${base}-1x1.${ext}`, { type: mime });
  } catch {
    return file;
  }
}

/**
 * Geometry for cropping an uploaded cover photo to a centred square.
 *
 * Every surface that shows a taxonomy cover is already 1:1 (`.cat-thumb` is
 * `aspect-ratio: 1/1`, `.catlist-thumb` is 64×64), and the <img> uses
 * `object-fit: cover` — so a non-square upload is silently centre-cropped at
 * DISPLAY time and the owner never sees which edges got cut. Cropping at UPLOAD
 * time instead makes the stored asset match what the storefront renders, so the
 * picker preview is the truth.
 */

export interface SquareCrop {
  /** Left edge of the crop within the source image, in source pixels. */
  sx: number;
  /** Top edge of the crop within the source image, in source pixels. */
  sy: number;
  /** Side length of the square taken from the source. */
  side: number;
  /** Side length actually written out — `side` capped at `max`, never upscaled. */
  out: number;
}

/**
 * Centred square crop for a `w`×`h` source, written out at no more than `max` px.
 *
 * Offsets are floored so `sx + side` can never exceed `w` (a rounded-up offset on
 * an odd overhang would read past the edge and produce a transparent stripe).
 */
export function centredSquareCrop(w: number, h: number, max: number): SquareCrop {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { sx: 0, sy: 0, side: 0, out: 0 };
  }
  const side = Math.min(w, h);
  return {
    sx: Math.floor((w - side) / 2),
    sy: Math.floor((h - side) / 2),
    side,
    out: Math.min(side, max),
  };
}

/** Longest side we store for a cover image — well above any tile size, still small. */
export const COVER_MAX_PX = 1024;

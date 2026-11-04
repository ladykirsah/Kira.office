/** The tallest the Scan camera box grows: 4:3, so a portrait camera doesn't push the page down. */
const MAX_HEIGHT_PER_WIDTH = 3 / 4;

/**
 * The Scan camera box takes the camera's own shape, so the picture fills it edge to edge (owner,
 * 4 Nov 2026: "make the camera to fill up · change edge size to fit camera"). Never flatter than the
 * usual height, never taller than 4:3; until the camera says its size, the usual height.
 */
export function cameraBoxHeight(
  width: number,
  video: { width: number; height: number } | null,
  fallback: number,
): number {
  if (width <= 0 || !video || video.width <= 0 || video.height <= 0) return fallback;
  const fitted = Math.round((width * video.height) / video.width);
  return Math.min(Math.max(fitted, fallback), Math.round(width * MAX_HEIGHT_PER_WIDTH));
}

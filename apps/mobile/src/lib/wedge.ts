/**
 * A handheld barcode scanner is a keyboard: it "types" the code very fast and presses Enter. Keys
 * that arrive this close together belong to one scan; a slower gap means a person is typing.
 */
const MAX_GAP_MS = 80;
/** Shorter than this after Enter is a stray keypress, not a code. */
const MIN_LENGTH = 3;
/** The same label unseen for this long, then seen again, is scanned again. */
const REPEAT_MS = 2000;

export interface Wedge {
  buffer: string;
  lastAt: number;
}

export const EMPTY_WEDGE: Wedge = { buffer: "", lastAt: 0 };

export function feedKey(
  wedge: Wedge,
  key: string,
  at: number,
): { wedge: Wedge; code: string | null } {
  if (key === "Enter") {
    const code = wedge.buffer.length >= MIN_LENGTH ? wedge.buffer : null;
    return { wedge: EMPTY_WEDGE, code };
  }
  if (key.length !== 1) return { wedge, code: null };
  const continues = wedge.buffer !== "" && at - wedge.lastAt <= MAX_GAP_MS;
  return { wedge: { buffer: continues ? wedge.buffer + key : key, lastAt: at }, code: null };
}

export interface Sighting {
  code: string;
  at: number;
}

/**
 * One camera read. A label held in view is read many times a second; it counts as a scan only when
 * it is a different code, or the same one coming back after it has been out of view for a while.
 * Every read moves "last seen" forward, so holding a label still never makes a second scan.
 */
export function sightCode(
  last: Sighting | null,
  code: string,
  now: number,
): { isNew: boolean; last: Sighting } {
  const stillInView = last !== null && last.code === code && now - last.at < REPEAT_MS;
  return { isNew: !stillInView, last: { code, at: now } };
}

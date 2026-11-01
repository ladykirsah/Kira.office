import type { CSSProperties, MouseEvent } from "react";

/**
 * The browser's own date / time box, laid over a PickerPill and unseen: the pill shows the value in
 * the app's font, the box opens the phone's wheel. 16px keeps iPhone Safari from zooming in on tap.
 */
export const UNSEEN_PICKER: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  margin: 0,
  padding: 0,
  border: 0,
  opacity: 0,
  fontSize: 16,
  cursor: "pointer",
};

/** A computer's browser opens the picker only from its own icon; ask it to open on any click. */
export function openPicker(e: MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    // Some browsers refuse outside a direct tap; the box still takes the click as before.
  }
}

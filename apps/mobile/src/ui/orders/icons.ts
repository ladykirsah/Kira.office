import type { StepIcon, StepTone } from "@/lib/orderList";
import type { Theme } from "../theme";

/** The Orders pages' line icons (24-unit grid), drawn as in the approved Orders drawing. */
export const ICON = {
  plus: "M12 5v14M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "M9 5l7 7-7 7",
  check: "M5 12.5l4.5 4.5L19 7.5",
  copy: "M9 9h12v12H9zM5 15V5a2 2 0 0 1 2-2h10",
  print: "M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z",
  scan: "M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16M7.5 8v8M10.5 8v8M13.5 8v8M16.5 8v8",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  pending: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18",
  box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7",
  alert: "M12 8v5M12 16.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18",
  pin: "M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  note: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h5",
  phone:
    "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  ban: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M5.6 5.6l12.8 12.8",
} as const;

export const STEP_ICON: Record<StepIcon, string> = {
  slip: "M7 3h7l5 5v13H7zM14 3v5h5M10 14.5l2 2 4-4",
  cod: "M3 6h18v12H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5",
  ship: ICON.box,
  back: "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  claim: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z",
};

/** A status colours only its icon or dot, never its words (design guide). */
export function toneColor(tone: StepTone, theme: Theme): string {
  switch (tone) {
    case "waiting":
      return theme.waiting;
    case "toShip":
      return theme.toShip;
    case "danger":
      return theme.danger;
    case "muted":
      return theme.textMuted;
  }
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The row of filter tabs, shared by ออเดอร์, สินค้า and การเงิน.
 *
 * WHY IT IS A COMPONENT AND NOT JUST A CLASS (owner, 27 Aug 2026, design A of three). On a phone
 * the row stops wrapping and scrolls sideways instead — eight order filters were taking three lines
 * and 121px before the first order appeared. Scrolling costs one thing the wrapped row never had:
 * a tab can now be OFF SCREEN, and the one that matters most is the active one.
 *
 * That is not hypothetical. Tapping "กำลังจัดส่ง" on the dashboard opens /orders already filtered
 * to it — the eighth-ish tab — and a strip that always starts at "ทั้งหมด" would show the first tab
 * looking unselected, with no sign that a filter is on at all. So the active tab is scrolled into
 * view whenever it changes.
 *
 * `block: "nearest"` matters as much as the inline part: without it the browser is free to scroll
 * the PAGE to bring the strip into view, which would yank someone away from what they were reading.
 *
 * GATED TO THE PHONE, and deliberately by the same 741px the stylesheet uses. On a wide screen the
 * row still wraps and nothing scrolls, so the call would be a no-op — but "would be a no-op" is not
 * the same promise as "does not run", and this whole pass is a mobile-only one. The width is the
 * gate, so there is exactly one number to change if the breakpoint ever moves.
 */
const PHONE = "(max-width: 741px)";

export function TabStrip({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  /**
   * Which tab was active last time, as its POSITION in the row.
   *
   * Only a CHANGE of tab may move the strip. Without this the effect fires on every render — and
   * these rows re-render on every keystroke in the search box beside them — so scrolling along to
   * read the far filters and then typing would snap the strip back under your thumb.
   *
   * The position, not the label: the labels carry live counts, so "สำเร็จ (0)" becoming
   * "สำเร็จ (1)" would read as a different tab and yank the strip for a number changing.
   */
  const wasActive = useRef<number | null>(null);

  useEffect(() => {
    if (!window.matchMedia(PHONE).matches) return;
    const row = ref.current;
    const active = row?.querySelector(".tab.active");
    if (!row || !active) return;
    const at = [...row.children].indexOf(active);
    if (at === wasActive.current) return;
    wasActive.current = at;
    active.scrollIntoView({ inline: "nearest", block: "nearest" });
  });

  return (
    <div className="tabs" ref={ref}>
      {children}
    </div>
  );
}

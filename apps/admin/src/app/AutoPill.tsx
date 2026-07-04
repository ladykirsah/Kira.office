"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A pill that rounds fully (stadium) on a single line but switches to an 8px box once its text wraps
 * to 2+ lines — short status tags stay stadium-shaped while long ones read as rounded boxes. Wrapping
 * is layout-dependent (column width, content), so it's measured in the browser: the `boxed` class is
 * toggled by comparing the rendered content height to a single line-height.
 */
export function AutoPill({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [boxed, setBoxed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const lineHeight = parseFloat(cs.lineHeight);
      const padV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const lines = lineHeight > 0 ? Math.round((el.clientHeight - padV) / lineHeight) : 1;
      setBoxed(lines >= 2);
    };
    measure();
    // Re-measure when the pill reflows (e.g. the column narrows) so the shape tracks the wrap.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  return (
    <span ref={ref} className={boxed ? `${className} boxed` : className}>
      {children}
    </span>
  );
}

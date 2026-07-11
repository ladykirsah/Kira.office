"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const pad = (n: number) => String(n).padStart(2, "0");

/** Split remaining ms into d/h/m/s parts. */
function parts(msLeft: number) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/**
 * 1s-ticking flash-sale countdown. At zero it renders "จบแล้ว" and refreshes the route ONCE so the
 * server re-resolves prices (an ended campaign disappears without any client price math).
 * `variant="boxes"` renders HH:MM:SS in white boxes (with a "N วัน" chip when >24h) for the flash
 * hero; the default renders the inline "เหลือ …" text.
 * suppressHydrationWarning: the server snapshot is at most a second stale vs. the client tick — the
 * flag must sit on every element whose text actually ticks (React only suppresses one level deep),
 * so the "boxes" variant carries it on each digit/day span, not just the wrapper.
 */
export function Countdown({
  endsAt,
  prefix = "เหลือ",
  variant = "text",
}: {
  endsAt: number;
  prefix?: string;
  variant?: "text" | "boxes";
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const refreshedRef = useRef(false);
  const over = now >= endsAt;

  useEffect(() => {
    if (over) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [over]);

  useEffect(() => {
    if (over && !refreshedRef.current) {
      refreshedRef.current = true;
      router.refresh();
    }
  }, [over, router]);

  if (over) return <span suppressHydrationWarning>จบแล้ว</span>;

  const p = parts(endsAt - now);

  if (variant === "boxes") {
    // HH:MM:SS only — days are folded into the hours so nothing is lost when the "วัน" chip is gone.
    const totalHours = p.days * 24 + p.hours;
    const aria = `เหลือเวลา ${totalHours} ชั่วโมง ${p.minutes} นาที ${p.seconds} วินาที`;
    return (
      <span className="cd-boxes" role="timer" aria-label={aria} suppressHydrationWarning>
        <span className="cd-box" aria-hidden="true" suppressHydrationWarning>
          {pad(totalHours)}
        </span>
        <span className="cd-sep" aria-hidden="true">
          :
        </span>
        <span className="cd-box" aria-hidden="true" suppressHydrationWarning>
          {pad(p.minutes)}
        </span>
        <span className="cd-sep" aria-hidden="true">
          :
        </span>
        <span className="cd-box" aria-hidden="true" suppressHydrationWarning>
          {pad(p.seconds)}
        </span>
      </span>
    );
  }

  const hms = `${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`;
  return (
    <span suppressHydrationWarning>
      {prefix} {p.days > 0 ? `${p.days} วัน ${hms}` : hms}
    </span>
  );
}

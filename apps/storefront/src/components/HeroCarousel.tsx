"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { imgUrl } from "@/lib/img";

export interface HeroBanner {
  id: string;
  imageKey: string | null;
  linkUrl: string | null;
}

/** Internal path → Link, external https → new-tab anchor, no/odd link → plain wrapper. */
function Slide({
  linkUrl,
  children,
  ariaLabel,
}: {
  linkUrl: string | null;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  const style: React.CSSProperties = {
    flex: "0 0 100%",
    scrollSnapAlign: "start",
    aspectRatio: "2659 / 984",
    display: "block",
  };
  if (linkUrl && linkUrl.startsWith("/")) {
    return (
      <Link href={linkUrl} style={style} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  if (linkUrl && linkUrl.startsWith("https://")) {
    return (
      <a href={linkUrl} target="_blank" rel="noopener" style={style} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return <div style={style}>{children}</div>;
}

/**
 * Full-width scroll-snap hero carousel (reference-1 top slot). Auto-advances every 5s until the
 * user touches it; dots track the scroll position. 1 banner = static image, 0 = nothing.
 * Local-dev images 404 — every slide falls back to the Thai placeholder frame.
 */
export function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const count = banners.length;

  useEffect(() => {
    if (count <= 1 || paused) return;
    const timer = setInterval(() => {
      const el = trackRef.current;
      if (!el || el.clientWidth === 0) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % count;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(timer);
  }, [count, paused]);

  if (count === 0) return null;

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div>
      <div
        ref={trackRef}
        onTouchStart={() => setPaused(true)}
        onPointerDown={() => setPaused(true)}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
        style={{
          display: "flex",
          overflowX: count > 1 ? "auto" : "hidden",
          scrollSnapType: "x mandatory",
          borderRadius: "var(--radius)",
          background: "var(--hover)",
          scrollbarWidth: "none",
        }}
        aria-label="แบนเนอร์โปรโมชัน"
      >
        {banners.map((b, i) => (
          <Slide key={b.id} linkUrl={b.linkUrl} ariaLabel={`แบนเนอร์ที่ ${i + 1}`}>
            {b.imageKey && !failed[b.id] ? (
              <img
                src={imgUrl(b.imageKey)}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                onError={() => setFailed((prev) => ({ ...prev, [b.id]: true }))}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div
                className="frame"
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ fontSize: 44, lineHeight: 1, color: "var(--brand)" }}
                >
                  ✦
                </span>
              </div>
            )}
          </Slide>
        ))}
      </div>

      {count > 1 && (
        <div
          style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}
          role="tablist"
          aria-label="เลือกแบนเนอร์"
        >
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`ไปที่แบนเนอร์ ${i + 1}`}
              onClick={() => {
                setPaused(true);
                goTo(i);
              }}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                border: "none",
                padding: 0,
                background: i === active ? "var(--accent)" : "var(--border)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

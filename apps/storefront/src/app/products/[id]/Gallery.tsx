"use client";

import { useRef, useState } from "react";
import { imgUrl } from "@/lib/img";

interface GalleryProps {
  images: { imageKey: string }[];
  coverKey: string | null;
  name: string;
}

/** Hard cap on gallery images (owner-facing rule): a product shows at most 10 photos. */
const MAX_IMAGES = 10;
/** Placeholder slides shown ONLY while a product has no real photos, so the multi-image carousel +
 *  page counter is previewable now. Real uploaded images (2–10) replace these automatically. */
const MOCK_EMPTY_SLIDES = 4;

/**
 * Swipe carousel (Lovito/Shopee pattern): full-width square slides with scroll-snap, a "current/total"
 * page badge bottom-right, and dot navigation — up to 10 images. Local dev R2 keys often 404, so
 * every <img> falls back to the Thai ✦ placeholder on error.
 */
export function Gallery({ images, coverKey, name }: GalleryProps) {
  const realKeys = (
    images.length > 0 ? images.map((i) => i.imageKey) : coverKey ? [coverKey] : []
  ).slice(0, MAX_IMAGES);
  const slides: (string | null)[] =
    realKeys.length > 0 ? realKeys : Array<null>(MOCK_EMPTY_SLIDES).fill(null);

  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const trackRef = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = trackRef.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goTo = (i: number) => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div>
      <div style={{ position: "relative", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="pdp-gallery-track"
          style={{
            display: "flex",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}
        >
          {slides.map((key, i) => (
            <div
              key={i}
              className="frame"
              style={{
                flex: "0 0 100%",
                aspectRatio: "1 / 1",
                scrollSnapAlign: "start",
                borderRadius: 0,
              }}
            >
              {key && !failed[key] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgUrl(key)}
                  alt={name}
                  onError={() => setFailed((prev) => ({ ...prev, [key]: true }))}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{ color: "var(--brand)", fontSize: 44, lineHeight: 1 }}
                >
                  ✦
                </span>
              )}
            </div>
          ))}
        </div>

        {slides.length > 1 && (
          <div
            style={{
              position: "absolute",
              right: 10,
              bottom: 10,
              background: "rgba(40, 36, 30, 0.55)",
              color: "var(--white)",
              fontSize: 12,
              fontWeight: 700,
              padding: "2px 10px",
              borderRadius: 999,
            }}
          >
            {idx + 1}/{slides.length}
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`ไปรูปที่ ${i + 1}`}
              aria-current={i === idx}
              onClick={() => goTo(i)}
              style={{
                width: i === idx ? 18 : 7,
                height: 7,
                borderRadius: 999,
                border: "none",
                padding: 0,
                background: i === idx ? "var(--brand)" : "var(--gray-lite)",
                cursor: "pointer",
                transition: "width 0.2s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

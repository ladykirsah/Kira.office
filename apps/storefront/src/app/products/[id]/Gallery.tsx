"use client";

import { useState } from "react";
import { imgUrl } from "@/lib/img";

interface GalleryProps {
  images: { imageKey: string }[];
  coverKey: string | null;
  name: string;
}

/**
 * Zara-style image-first gallery: full-width square main frame + thumb strip.
 * Local dev R2 keys often 404 — every <img> falls back to a Thai placeholder on error.
 */
export function Gallery({ images, coverKey, name }: GalleryProps) {
  const keys = images.length > 0 ? images.map((i) => i.imageKey) : coverKey ? [coverKey] : [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  const mainFrameStyle: React.CSSProperties = {
    aspectRatio: "1 / 1",
    width: "100%",
    borderRadius: "var(--radius)",
  };

  if (keys.length === 0) {
    return (
      <div className="frame" style={mainFrameStyle}>
        <span style={{ color: "var(--brand)", fontSize: 44, lineHeight: 1 }}>✦</span>
      </div>
    );
  }

  const selected = keys[Math.min(selectedIdx, keys.length - 1)];
  const markFailed = (key: string) => setFailed((prev) => ({ ...prev, [key]: true }));

  return (
    <div>
      <div className="frame" style={mainFrameStyle}>
        {failed[selected] ? (
          <span style={{ color: "var(--brand)", fontSize: 44, lineHeight: 1 }}>✦</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl(selected)} alt={name} onError={() => markFailed(selected)} />
        )}
      </div>

      {keys.length > 1 && (
        <div
          style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", padding: "2px 0" }}
        >
          {keys.map((key, i) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedIdx(i)}
              aria-label={`ดูรูปที่ ${i + 1}`}
              aria-current={i === selectedIdx}
              className="frame"
              style={{
                width: 64,
                height: 64,
                flex: "0 0 auto",
                padding: 0,
                border: i === selectedIdx ? "2px solid var(--accent)" : "2px solid var(--border)",
              }}
            >
              {failed[key] ? (
                <span style={{ color: "var(--brand)", fontSize: 24, lineHeight: 1 }}>✦</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgUrl(key)} alt="" onError={() => markFailed(key)} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

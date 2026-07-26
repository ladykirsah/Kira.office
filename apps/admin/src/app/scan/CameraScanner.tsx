"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Phone-camera barcode scanner for the /scan modes. The decode library (@zxing/browser) is imported
 * dynamically so it only loads when the camera is actually opened, not on every admin page. It reads
 * from the back camera and calls `onCode` for each scan; a short debounce collapses the ~30 decodes/s
 * a single physical barcode produces into one call. getUserMedia needs a secure context (https or
 * localhost) — handled with a clear message rather than a silent failure.
 */
export function CameraScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const last = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  // Keep the latest onCode without restarting the camera when the parent re-renders.
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("The camera needs a secure (https) connection.");
      return;
    }
    let controls: { stop: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) return;
        const c = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video,
          (result) => {
            if (!result) return;
            const code = result.getText().trim();
            if (!code) return;
            const now = Date.now();
            // Same barcode within 1.5s = the same physical scan still in frame; ignore the repeats.
            if (code === last.current.code && now - last.current.at < 1500) return;
            last.current = { code, at: now };
            onCodeRef.current(code);
          },
        );
        if (cancelled) c.stop();
        else controls = c;
      } catch (e) {
        setError(
          e instanceof Error && /permission|denied|notallowed/i.test(e.message)
            ? "Camera permission was denied."
            : "Couldn't start the camera.",
        );
      }
    })();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <div style={{ ...panel }}>
      {error ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {error}
        </p>
      ) : (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", borderRadius: 10, background: "#000", display: "block" }}
          />
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
            Point the back camera at a barcode.
          </p>
        </>
      )}
      <button type="button" onClick={onClose} style={{ marginTop: 10 }}>
        Close camera
      </button>
    </div>
  );
}

const panel = {
  maxWidth: 360,
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 12,
  background: "var(--surface)",
} as const;

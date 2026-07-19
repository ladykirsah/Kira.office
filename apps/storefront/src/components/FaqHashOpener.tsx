"use client";

import { useEffect } from "react";

/**
 * Opens the FAQ card targeted by the URL hash. Browsers scroll to a hash target but never open a
 * closed <details>, so in-page links between answers ({l:#...} tokens) need this tiny helper.
 */
export function FaqHashOpener() {
  useEffect(() => {
    const openFromHash = () => {
      const raw = decodeURIComponent(window.location.hash.slice(1));
      if (!raw) return;
      const el = document.getElementById(raw);
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);
  return null;
}

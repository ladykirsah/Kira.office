"use client";

import type { TrackKind } from "./trackEvent";

/**
 * Client half of the traffic beacon: fire-and-forget, never blocking, never throwing.
 *
 * `navigator.sendBeacon` is the right primitive here rather than `fetch`. The browser queues the
 * request and sends it independently of the page, so it survives a navigation that happens
 * immediately afterwards — which is precisely the case for a product-card click, the event most
 * likely to be followed by the page going away. It also cannot be awaited, which is a feature: no
 * caller can accidentally make the UI wait on analytics.
 *
 * Every failure is silent. There is no retry, no queue, no error surface. A metric that did not
 * record is invisible; a storefront that broke because a metric did not record is a lost sale.
 */
export function track(kind: TrackKind, productId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      kind,
      path: window.location.pathname,
      productId: productId ?? null,
      // Where the VISITOR came from. The server cannot work this out for itself: the `Referer`
      // header on this POST is our own page, so the arrival has to be reported from here. The
      // server classifies it into a bucket and throws the URL away.
      referrer: document.referrer || null,
    });
    // sendBeacon is unavailable in a few older in-app browsers; keepalive fetch is the same
    // "survives navigation" guarantee by another name.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Deliberately empty — see the note above.
  }
}

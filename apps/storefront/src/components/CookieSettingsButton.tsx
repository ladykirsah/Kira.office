"use client";

import { OPEN_SETTINGS_EVENT } from "@/lib/cookieConsent";

/**
 * Re-opens the cookie consent banner in Design-C settings mode (the CookieConsent island in the root
 * layout listens for OPEN_SETTINGS_EVENT). Lets the /cookies policy page offer "change your choice"
 * from any page, as PDPA requires.
 */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      className="btn btn-outline btn-primary"
      onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}
    >
      ตั้งค่าคุกกี้ของฉัน
    </button>
  );
}

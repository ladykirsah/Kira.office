"use client";

import { SHOP_PROFILES, SHOP_PROFILE_LABELS, type ShopProfile } from "@l-shopee/core";

/**
 * The Den Air Service / AirPlus switcher — the one implementation, shared by every page that shows
 * per-business data (Shop info, Customers).
 *
 * It exists as a component rather than a copied block so the two can't drift: the pill sizing,
 * colours and position under the PageHeader are a design-system decision, not a per-page choice.
 * Always render it directly after <PageHeader>, which is what `marginTop` here assumes.
 */
export function BusinessTabs({
  value,
  onChange,
  disabled = false,
  disabledTitle,
  dimInactive = false,
}: {
  value: ShopProfile;
  onChange: (profile: ShopProfile) => void;
  /** Block switching — e.g. while an edit is open, so a half-typed change can't land on the other business. */
  disabled?: boolean;
  /** Tooltip explaining why switching is blocked. */
  disabledTitle?: string;
  /** Fade the profile you're not on, to show the switcher is currently inert. */
  dimInactive?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Business profile"
      style={{ display: "flex", gap: 8, marginTop: 14 }}
    >
      {SHOP_PROFILES.map((p) => {
        const active = p === value;
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            title={disabled ? disabledTitle : undefined}
            onClick={() => onChange(p)}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 14,
              cursor: disabled ? "not-allowed" : "pointer",
              border: `1px solid ${active ? "var(--accent, #bf3c1d)" : "var(--border)"}`,
              background: active ? "var(--accent, #bf3c1d)" : "var(--surface)",
              color: active ? "#fff" : "var(--text)",
              opacity: dimInactive && !active ? 0.5 : 1,
            }}
          >
            {SHOP_PROFILE_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}

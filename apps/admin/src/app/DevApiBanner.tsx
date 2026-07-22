"use client";

import { useEffect, useState } from "react";
import { apiBase } from "@/lib/apiFetch";
import { describeApiMismatch } from "@/lib/devApiMismatch";

/**
 * Warns when a locally-run admin is pointed at the remote API, where it can never authenticate.
 *
 * Without this, that setup is indistinguishable from an empty database: most pages render "No
 * values yet" rather than an error, so a 401 on every request reads as missing data. It cost the
 * owner a session of believing production had been wiped.
 *
 * Renders nothing on the deployed admin — the check runs in an effect (not during render) because
 * it reads window.location, which does not exist on the server and would break hydration.
 */
export function DevApiBanner() {
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    setWarning(describeApiMismatch(window.location.hostname, apiBase));
  }, []);

  if (!warning) return null;

  return (
    <div
      role="status"
      // Distinct hook: ToastProvider's container also uses role="status", which made a verification
      // pass read the wrong element and report a false positive.
      data-dev-api-banner=""
      style={{
        background: "#fff4e5",
        color: "#7a4100",
        border: "1px solid #ffb84d",
        borderRadius: 8,
        padding: "10px 14px",
        margin: "0 0 16px",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <strong>⚠ {warning}</strong>
    </div>
  );
}

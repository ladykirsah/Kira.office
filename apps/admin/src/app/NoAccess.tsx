"use client";

import { PageHeader } from "./PageHeader";
import { BackLink } from "./BackLink";

/**
 * What a page shows to someone whose role may not open it.
 *
 * The menu already hides these pages, but a typed address, a bookmark or a shared link still lands
 * here — and without this the page would render its whole frame and then fill with failed-request
 * errors, which reads as "broken" rather than "not yours". Says which it is, plainly, and offers a
 * way out instead of a dead end.
 *
 * This is a courtesy, not a lock: the API refuses the same data independently.
 */
export function NoAccess({ what }: { what: string }) {
  return (
    <main>
      <PageHeader
        title={what}
        subtitle="This page is for the shop owner only."
        below={<BackLink href="/">Dashboard</BackLink>}
      />
      <p className="muted">
        Your account does not have access to {what.toLowerCase()}. If you think it should, ask the
        shop owner.
      </p>
    </main>
  );
}

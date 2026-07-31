import { PageHeader } from "./PageHeader";
import { BackLink } from "./BackLink";

export default function NotFound() {
  return (
    <main>
      {/* Same header + under-subtitle back link as every other page. BackLink uses next/link, so
          this stays client-side and does not throw away the loaded admin bundle. */}
      <PageHeader
        title="Page not found"
        subtitle="That page doesn’t exist or has moved."
        below={<BackLink href="/">Back to dashboard</BackLink>}
      />
    </main>
  );
}

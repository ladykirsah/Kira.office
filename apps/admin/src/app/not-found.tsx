import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p className="muted">That page doesn’t exist or has moved.</p>
      <p>
        {/* Link, not <a>: a raw anchor triggers a full document reload and throws away the
            already-loaded admin bundle. */}
        <Link href="/">← Back to dashboard</Link>
      </p>
    </main>
  );
}

"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <h1>Something went wrong</h1>
      <p className="muted">{error.message || "An unexpected error occurred."}</p>
      <button className="btn-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}

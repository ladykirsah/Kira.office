"use client";

import { useRouter } from "next/navigation";

/**
 * Search-first entry point (reference #2 "Audio" kit): one large rounded input with a magnifier.
 * Submits to /products?q=… — client-side push when JS is up, plain form GET as the fallback.
 */
export function SearchBox({ initialQ, autoFocus }: { initialQ?: string; autoFocus?: boolean }) {
  const router = useRouter();
  return (
    <form
      action="/products"
      method="get"
      role="search"
      style={{ position: "relative" }}
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 16,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--text-faint)",
          pointerEvents: "none",
        }}
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>
      <input
        className="input"
        type="search"
        name="q"
        defaultValue={initialQ ?? ""}
        placeholder="ค้นหาด้วยรุ่นรถ หรือชื่ออะไหล่ เช่น ตู้แอร์ Vigo"
        aria-label="ค้นหาสินค้า"
        autoFocus={autoFocus}
        enterKeyHint="search"
        style={{
          minHeight: 46,
          paddingLeft: 46,
          borderRadius: 999,
          border: "none",
          boxShadow: "0 1px 4px rgba(55, 54, 54, 0.14)",
        }}
      />
    </form>
  );
}

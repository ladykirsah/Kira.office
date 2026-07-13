"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { pushRecentSearch } from "@/lib/recentSearches";
import { Icon } from "@/components/Icon";

/**
 * The /search page's own sticky orange header (its search bar replaces the generic InnerHeader on
 * this route — the three headers still partition the app). No inline magnifier; a circular coral
 * submit button. Submitting records the term to recent searches, then hands off to /products?q=…,
 * which owns the actual results + LIKE search. Plain <form> GET is the JS-off fallback.
 */
export function SearchLandingBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");

  if (pathname !== "/search") return null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const term = q.trim();
    if (term) pushRecentSearch(term);
    router.push(term ? `/products?q=${encodeURIComponent(term)}` : "/products");
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--brand)",
        color: "var(--white)",
      }}
    >
      <div
        className="wrap"
        style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 52, paddingBlock: 8 }}
      >
        <button
          type="button"
          onClick={goBack}
          aria-label="ย้อนกลับ"
          className="hdr-tap"
          style={{
            width: 40,
            height: 40,
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: -8,
            background: "transparent",
            border: "none",
            borderRadius: 999,
            color: "var(--white)",
            cursor: "pointer",
          }}
        >
          <Icon name="back" size={24} />
        </button>

        <form
          className="search-pill"
          role="search"
          action="/products"
          method="get"
          onSubmit={submit}
        >
          <input
            name="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาด้วยรุ่นรถ หรือชื่ออะไหล่"
            aria-label="ค้นหาสินค้า"
            enterKeyHint="search"
            autoFocus
          />
          <button type="submit" className="search-go" aria-label="ค้นหา">
            <Icon name="search" size={19} />
          </button>
        </form>
      </div>
    </header>
  );
}

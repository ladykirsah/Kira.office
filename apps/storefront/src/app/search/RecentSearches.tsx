"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readRecentSearches } from "@/lib/recentSearches";

/**
 * "ค้นหาล่าสุด" chips from localStorage. Read AFTER mount only (server renders nothing, so the
 * initial client render also renders nothing → hydration never mismatches, same bet as
 * RecentlyViewed). Each chip re-runs the search via /products?q=. Hidden when there's no history.
 */
export function RecentSearches() {
  const [terms, setTerms] = useState<string[]>([]);

  useEffect(() => {
    setTerms(readRecentSearches());
  }, []);

  if (terms.length === 0) return null;

  return (
    <section>
      <h2 className="search-head">
        🕘 ค้นหาล่าสุด <small>· Recent</small>
      </h2>
      <div className="search-chips">
        {terms.map((t) => (
          <Link key={t} href={`/products?q=${encodeURIComponent(t)}`} className="chip">
            {t}
          </Link>
        ))}
      </div>
    </section>
  );
}

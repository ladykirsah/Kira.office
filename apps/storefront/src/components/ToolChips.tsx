"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Category filter for /tools. Selecting a chip rewrites `?cat=` on the SAME page.
 *
 * router.replace, never push: the back arrow must return to the page the customer came from, not
 * walk backwards through their filter choices one chip at a time (the store-wide back-nav rule).
 * scroll:false keeps the eye where the chips are instead of jumping to the top on every tap.
 */
export function ToolChips({
  chips,
  active,
}: {
  chips: { slug: string; name: string; total: number }[];
  active: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (slug: string | null) => {
    startTransition(() => {
      router.replace(slug ? `/tools?cat=${encodeURIComponent(slug)}` : "/tools", { scroll: false });
    });
  };

  return (
    <div className="chip-row" style={{ opacity: pending ? 0.65 : 1 }}>
      <button
        type="button"
        className={`chip${active ? "" : " chip--on"}`}
        aria-pressed={!active}
        onClick={() => go(null)}
      >
        ทั้งหมด
      </button>
      {chips.map((c) => (
        <button
          key={c.slug}
          type="button"
          className={`chip${active === c.slug ? " chip--on" : ""}`}
          aria-pressed={active === c.slug}
          onClick={() => go(c.slug)}
        >
          {c.name} <span className="chip-n">{c.total}</span>
        </button>
      ))}
    </div>
  );
}

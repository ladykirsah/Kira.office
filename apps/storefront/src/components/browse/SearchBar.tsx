"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cartCount, useCart } from "@/lib/cart";
import { pushRecentSearch } from "@/lib/recentSearches";
import { Icon } from "@/components/Icon";

const SEARCH_PLACEHOLDER = "ค้นหาด้วยรุ่นรถ หรือชื่ออะไหล่";

function useBack(): () => void {
  const router = useRouter();
  return () => (window.history.length > 1 ? router.back() : router.push("/"));
}

function CartButton() {
  const count = cartCount(useCart());
  return (
    <Link href="/cart" className="b2-icon-btn" aria-label={`ตะกร้า (${count} ชิ้น)`}>
      <Icon name="cart" size={22} />
      {count > 0 && <span className="sub-head-badge">{count}</span>}
    </Link>
  );
}

/**
 * 2.1 search bar: grey like the page (sub-page bar B), white box. Submitting records the term to the
 * recent searches and opens the results (/products?q=…); a plain GET form is the JS-off fallback.
 */
export function SearchInputBar({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const back = useBack();
  const [q, setQ] = useState(initialQ);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const term = q.trim();
    if (term) pushRecentSearch(term);
    router.push(term ? `/products?q=${encodeURIComponent(term)}` : "/products");
  }

  return (
    <header className="b2-search">
      <button type="button" className="b2-icon-btn" aria-label="กลับ" onClick={back}>
        <Icon name="back" size={22} />
      </button>
      <form className="b2-box" role="search" action="/products" method="get" onSubmit={submit}>
        <Icon name="search" size={18} />
        <input
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label="ค้นหาสินค้า"
          enterKeyHint="search"
          autoFocus
        />
      </form>
      <CartButton />
    </header>
  );
}

/**
 * 2.2 results bar: the term in the white box (tap → edit it on the search page) and a grey × that
 * clears it. With no term (all products) the box shows the hint.
 */
export function SearchResultBar({ q }: { q: string }) {
  const back = useBack();
  const editHref = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
  return (
    <header className="b2-search">
      <button type="button" className="b2-icon-btn" aria-label="กลับ" onClick={back}>
        <Icon name="back" size={22} />
      </button>
      <div className="b2-box">
        <Icon name="search" size={18} />
        <Link href={editHref} className="b2-box-text" aria-label="แก้คำค้นหา">
          {q || <span style={{ color: "var(--hm-grey)" }}>{SEARCH_PLACEHOLDER}</span>}
        </Link>
        {q && (
          <Link href="/search" className="b2-box-clear" aria-label="ล้างคำค้น">
            <Icon name="close" size={18} />
          </Link>
        )}
      </div>
      <CartButton />
    </header>
  );
}

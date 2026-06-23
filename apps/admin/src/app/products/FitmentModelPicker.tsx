"use client";

import { useEffect, useRef, useState } from "react";

export interface Generation {
  name: string;
  from: number | null;
  to: number | null;
}

const eraOf = (from: number | null, to: number | null) =>
  from && to ? `${from} – ${to}` : from ? `${from}+` : to ? `– ${to}` : "";

/** "Vios · 2007 – 2013" when an era is present, otherwise just the model name. */
export const genLabel = (name: string, from: number | null, to: number | null) => {
  const e = eraOf(from, to);
  return e ? `${name} · ${e}` : name;
};

/**
 * Picks a specific model generation (name + era) for a fitment row. Selecting an option carries its
 * year range; a part that fits several generations gets one row each. Typing filters; an unmatched
 * value can still be used as a new (era-less) model. Local query state means typing never clobbers
 * the row until you actually pick.
 */
export function FitmentModelPicker({
  value,
  options,
  onPick,
  placeholder,
}: {
  value: { carModel: string | null; yearFrom: number | null; yearTo: number | null };
  options: Generation[];
  onPick: (g: Generation) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const currentLabel = value.carModel ? genLabel(value.carModel, value.yearFrom, value.yearTo) : "";
  const shown = query ?? currentLabel;
  const q = (query ?? "").trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          genLabel(o.name, o.from, o.to).toLowerCase().includes(q) ||
          o.name.toLowerCase().includes(q),
      )
    : options;
  const isNew =
    q.length > 0 &&
    !options.some(
      (o) => o.name.toLowerCase() === q || genLabel(o.name, o.from, o.to).toLowerCase() === q,
    );

  const pick = (g: Generation) => {
    onPick(g);
    setQuery(null);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={shown}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery(null);
          }
        }}
        placeholder={placeholder}
        style={{ width: "100%", paddingRight: 30 }}
        role="combobox"
        aria-expanded={open}
      />
      <button
        type="button"
        className="combo-caret"
        aria-label="Toggle list"
        tabIndex={-1}
        onClick={() => setOpen((o) => !o)}
      >
        ▾
      </button>
      {open && (filtered.length > 0 || isNew) && (
        <div className="combo-pop">
          {filtered.map((o, i) => (
            <button key={i} type="button" className="combo-opt" onClick={() => pick(o)}>
              {genLabel(o.name, o.from, o.to)}
            </button>
          ))}
          {isNew && (
            <button
              type="button"
              className="combo-opt combo-new"
              onClick={() => pick({ name: (query ?? "").trim(), from: null, to: null })}
            >
              Use “{(query ?? "").trim()}” (new)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

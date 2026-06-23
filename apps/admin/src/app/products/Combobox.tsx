"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Creatable combobox: click to see the list, type to filter or enter a brand-new value. Built with
 * plain state instead of native <datalist> (which is unreliable in Safari).
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const isNew = q.length > 0 && !options.some((o) => o.toLowerCase() === q);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
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
          {filtered.map((o) => (
            <button key={o} type="button" className="combo-opt" onClick={() => pick(o)}>
              {o}
            </button>
          ))}
          {isNew && (
            <button type="button" className="combo-opt combo-new" onClick={() => setOpen(false)}>
              Use “{value.trim()}” (new)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

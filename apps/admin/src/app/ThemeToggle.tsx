"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved =
      (localStorage.getItem("theme") as "light" | "dark" | null) ??
      (document.documentElement.dataset.theme as "light" | "dark" | undefined) ??
      "light";
    setTheme(saved);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore (private mode)
    }
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title="Toggle dark mode"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

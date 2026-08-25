"use client";

import { useEffect, useState } from "react";
import { useT } from "./LangProvider";

export function ThemeToggle() {
  const t = useT();
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
      aria-label={
        theme === "dark"
          ? t({ th: "เปลี่ยนเป็นโหมดสว่าง", en: "Switch to light mode" })
          : t({ th: "เปลี่ยนเป็นโหมดมืด", en: "Switch to dark mode" })
      }
      title={t({ th: "สลับโหมดมืด", en: "Toggle dark mode" })}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

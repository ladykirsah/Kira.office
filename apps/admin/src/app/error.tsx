"use client";

import { useT } from "./LangProvider";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <main>
      <h1>{t({ th: "เกิดข้อผิดพลาด", en: "Something went wrong" })}</h1>
      <p className="muted">
        {error.message ||
          t({ th: "มีข้อผิดพลาดที่ไม่คาดคิดเกิดขึ้น", en: "An unexpected error occurred." })}
      </p>
      <button className="btn-primary" onClick={reset}>
        {t({ th: "ลองอีกครั้ง", en: "Try again" })}
      </button>
    </main>
  );
}

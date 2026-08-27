import { serverT } from "@/lib/serverLang";
import { PageHeader } from "./PageHeader";
import { BackLink } from "./BackLink";

export default async function NotFound() {
  const t = await serverT();
  return (
    <main>
      {/* Same header + under-subtitle back link as every other page. BackLink uses next/link, so
          this stays client-side and does not throw away the loaded admin bundle. */}
      <PageHeader
        title={t({ th: "ไม่พบหน้านี้", en: "Page not found" })}
        subtitle={t({
          th: "หน้านี้ไม่มีอยู่ หรือถูกย้ายไปแล้ว",
          en: "That page doesn’t exist or has moved.",
        })}
        below={<BackLink href="/">{t({ th: "กลับไปหน้าหลัก", en: "Back to dashboard" })}</BackLink>}
      />
    </main>
  );
}

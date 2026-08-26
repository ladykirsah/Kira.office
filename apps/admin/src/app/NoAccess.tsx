"use client";

import { PageHeader } from "./PageHeader";
import { BackLink } from "./BackLink";
import { useT } from "./LangProvider";
import type { Phrase } from "@/lib/lang";

/**
 * What a page shows to someone whose role may not open it.
 *
 * The menu already hides these pages, but a typed address, a bookmark or a shared link still lands
 * here — and without this the page would render its whole frame and then fill with failed-request
 * errors, which reads as "broken" rather than "not yours". Says which it is, plainly, and offers a
 * way out instead of a dead end.
 *
 * This is a courtesy, not a lock: the API refuses the same data independently.
 */
export function NoAccess({ what, who }: { what: Phrase; who?: Phrase }) {
  const t = useT();
  const page = t(what);
  const owner = t(who ?? { th: "เจ้าของร้าน", en: "the shop owner" });
  return (
    <main>
      <PageHeader
        title={page}
        subtitle={t({ th: `หน้านี้สำหรับ${owner}เท่านั้น`, en: `This page is for ${owner} only.` })}
        below={<BackLink href="/">{t({ th: "หน้าหลัก", en: "Dashboard" })}</BackLink>}
      />
      <p className="muted">
        {t({
          th: `บัญชีของคุณเปิด${page}ไม่ได้ · ถ้าคิดว่าควรเปิดได้ ให้บอกเจ้าของร้าน`,
          // Lowercased because the name is being dropped into the middle of a sentence, where a
          // capital would read as a shout: "access to Editing products" reads wrong.
          en: `Your account does not have access to ${page.toLowerCase()}. If you think it should, ask the shop owner.`,
        })}
      </p>
    </main>
  );
}

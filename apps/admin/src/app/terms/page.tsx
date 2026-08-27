"use client";

import { useEffect, useMemo, useState } from "react";
import { renderTerms, extractPlaceholders, findMissingPlaceholders } from "@l-shopee/core";
import { inputS } from "@/lib/inputStyles";
import { fetchTermsTemplate, saveTermsTemplate } from "@/lib/api";
import { PageHeader } from "../PageHeader";
import { useToast } from "../ToastProvider";
import { useT } from "../LangProvider";
import type { Phrase } from "@/lib/lang";

const TITLE: Phrase = { th: "แก้ไขเงื่อนไขภาษาไทย", en: "Thai T&C editor" };

export default function TermsPage() {
  const t = useT();
  const [template, setTemplate] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        setTemplate(await fetchTermsTemplate());
      } catch (err) {
        toast((err as Error).message, "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const placeholders = useMemo(() => extractPlaceholders(template), [template]);
  const rendered = renderTerms(template, values);
  const missing = findMissingPlaceholders(template, values);

  async function save() {
    setBusy(true);
    try {
      await saveTermsTemplate(template);
      toast(t({ th: "บันทึกแล้ว ✓", en: "Saved ✓" }), "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <main>
        <h1>{t(TITLE)}</h1>
        <div className="skeleton skeleton-row" style={{ width: "100%", height: 160 }} />
      </main>
    );

  return (
    <main>
      <PageHeader
        title={t(TITLE)}
        subtitle={
          <>
            {t({ th: "ใช้", en: "Use" })} <code>{"{{placeholder}}"}</code>{" "}
            {t({
              th: "สำหรับช่องที่กรอกต่างกันในแต่ละสินค้า/การขาย",
              en: "for fields filled in per product/sale.",
            })}
          </>
        }
      />
      <textarea
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        rows={8}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
      />
      <div style={{ marginTop: 8 }}>
        <button className="btn-primary" onClick={save} disabled={busy}>
          {t({ th: "บันทึกเทมเพลต", en: "Save template" })}
        </button>
      </div>

      <h2 style={{ marginTop: 20 }}>{t({ th: "ช่องที่ต้องกรอก", en: "Placeholders" })}</h2>
      {placeholders.length === 0 ? (
        <p style={{ color: "var(--text-faint)" }}>{t({ th: "ไม่มี", en: "none" })}</p>
      ) : (
        <div style={{ display: "grid", gap: 6, maxWidth: 360 }}>
          {placeholders.map((p) => (
            <label key={p} style={{ display: "grid", gap: 2 }}>
              {p}
              <input
                value={values[p] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
                style={inputS}
              />
            </label>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 20 }}>{t({ th: "ตัวอย่าง", en: "Preview" })}</h2>
      {missing.length > 0 && (
        <p style={{ color: "var(--warn)" }}>
          {t({ th: "ยังไม่ได้กรอก:", en: "Missing values:" })} {missing.join(", ")}
        </p>
      )}
      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "var(--code-bg)",
          padding: 12,
          borderRadius: 6,
        }}
      >
        {rendered}
      </pre>
    </main>
  );
}

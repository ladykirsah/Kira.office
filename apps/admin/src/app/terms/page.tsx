"use client";

import { useEffect, useMemo, useState } from "react";
import { renderTerms, extractPlaceholders, findMissingPlaceholders } from "@l-shopee/core";
import { fetchTermsTemplate, saveTermsTemplate } from "@/lib/api";
import { useToast } from "../ToastProvider";

export default function TermsPage() {
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
  }, []);

  const placeholders = useMemo(() => extractPlaceholders(template), [template]);
  const rendered = renderTerms(template, values);
  const missing = findMissingPlaceholders(template, values);

  async function save() {
    setBusy(true);
    try {
      await saveTermsTemplate(template);
      toast("Saved ✓", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <main>
        <h1>Thai T&amp;C editor</h1>
        <div className="skeleton skeleton-row" style={{ width: "100%", height: 160 }} />
      </main>
    );

  return (
    <main>
      <h1>Thai T&amp;C editor</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Use <code>{"{{placeholder}}"}</code> for fields filled in per product/sale.
      </p>
      <textarea
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        rows={8}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
      />
      <div style={{ marginTop: 8 }}>
        <button className="btn-primary" onClick={save} disabled={busy}>
          Save template
        </button>
      </div>

      <h2 style={{ marginTop: 20 }}>Placeholders</h2>
      {placeholders.length === 0 ? (
        <p style={{ color: "var(--text-faint)" }}>none</p>
      ) : (
        <div style={{ display: "grid", gap: 6, maxWidth: 360 }}>
          {placeholders.map((p) => (
            <label key={p} style={{ display: "grid", gap: 2 }}>
              {p}
              <input
                value={values[p] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 20 }}>Preview</h2>
      {missing.length > 0 && (
        <p style={{ color: "var(--warn)" }}>Missing values: {missing.join(", ")}</p>
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

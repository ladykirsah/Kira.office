"use client";

import { useEffect, useMemo, useState } from "react";
import { renderTerms, extractPlaceholders, findMissingPlaceholders } from "@l-shopee/core";
import { fetchTermsTemplate, saveTermsTemplate } from "@/lib/api";

export default function TermsPage() {
  const [template, setTemplate] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setTemplate(await fetchTermsTemplate());
      } catch (err) {
        setMsg((err as Error).message);
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
    setMsg("Saving…");
    try {
      await saveTermsTemplate(template);
      setMsg("Saved ✓");
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main>Loading…</main>;

  return (
    <main>
      <h1>Thai T&amp;C editor</h1>
      <p style={{ color: "#555" }}>
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
        </button>{" "}
        <small style={{ color: "#555" }}>{msg}</small>
      </div>

      <h2 style={{ marginTop: 20 }}>Placeholders</h2>
      {placeholders.length === 0 ? (
        <p style={{ color: "#999" }}>none</p>
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
        <p style={{ color: "#b26a00" }}>Missing values: {missing.join(", ")}</p>
      )}
      <pre style={{ whiteSpace: "pre-wrap", background: "#f6f6f6", padding: 12, borderRadius: 6 }}>
        {rendered}
      </pre>
    </main>
  );
}

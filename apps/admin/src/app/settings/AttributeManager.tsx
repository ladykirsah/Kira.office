"use client";

import { useEffect, useState } from "react";
import { inputS } from "@/lib/inputStyles";
import {
  fetchAttributes,
  addAttribute,
  deleteAttribute,
  type AttrKind,
  type AttrOption,
  type Attributes,
} from "@/lib/api";
import { useToast } from "../ToastProvider";
import { ConfirmButton } from "../ConfirmButton";

export interface AttrKindConfig {
  kind: AttrKind;
  label: string;
  listKey: keyof Attributes;
  placeholder: string;
}

function ListCard({
  label,
  placeholder,
  items,
  onAdd,
  onDelete,
}: {
  label: string;
  placeholder: string;
  items: AttrOption[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!val.trim()) return;
    setBusy(true);
    await onAdd(val.trim());
    setVal("");
    setBusy(false);
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 10 }}>{label}</div>
      {items.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
          No values yet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 4, marginBottom: 12 }}>
          {items.map((o) => (
            <div
              key={o.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                borderTop: "1px solid var(--border)",
                padding: "6px 0",
              }}
            >
              <span>{o.name}</span>
              <ConfirmButton confirmLabel="Remove?" onConfirm={() => onDelete(o.id)}>
                ✕
              </ConfirmButton>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          style={{ ...inputS, flex: 1, minWidth: 0 }}
        />
        <button type="submit" className="btn-primary btn-sm" disabled={busy || !val.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}

/** Reusable manager for a set of creatable attribute lists (one card per kind). */
export function AttributeManager({
  title,
  subtitle,
  kinds,
}: {
  title: string;
  subtitle: string;
  kinds: AttrKindConfig[];
}) {
  const [data, setData] = useState<Attributes | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  async function load() {
    try {
      setData(await fetchAttributes());
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(kind: AttrKind, name: string) {
    try {
      await addAttribute(kind, name);
      await load();
      toast("Added ✓", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function del(kind: AttrKind, id: string) {
    try {
      await deleteAttribute(kind, id);
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  return (
    <main>
      <h1>{title}</h1>
      <p className="muted" style={{ marginTop: -4 }}>
        {subtitle}
      </p>

      {loading ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
            gap: 14,
            marginTop: 16,
            maxWidth: 900,
            // Each card sizes to its own content instead of stretching to the tallest in the row.
            alignItems: "start",
          }}
        >
          {kinds.map((k) => (
            <ListCard
              key={k.kind}
              label={k.label}
              placeholder={k.placeholder}
              items={data ? data[k.listKey] : []}
              onAdd={(name) => add(k.kind, name)}
              onDelete={(id) => del(k.kind, id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

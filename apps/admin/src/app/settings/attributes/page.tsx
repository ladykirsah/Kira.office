"use client";

import { useEffect, useState } from "react";
import {
  fetchAttributes,
  addAttribute,
  deleteAttribute,
  type AttrKind,
  type AttrOption,
  type Attributes,
} from "@/lib/api";
import { useToast } from "../../ToastProvider";
import { ConfirmButton } from "../../ConfirmButton";

const KINDS: { kind: AttrKind; label: string; listKey: keyof Attributes; placeholder: string }[] = [
  { kind: "brand", label: "Part brands", listKey: "brands", placeholder: "Add brand…" },
  { kind: "usage", label: "Car systems", listKey: "usages", placeholder: "Add system…" },
  { kind: "type", label: "Part names", listKey: "types", placeholder: "Add part…" },
  { kind: "car_brand", label: "Car brands", listKey: "carBrands", placeholder: "Add car brand…" },
  { kind: "car_model", label: "Car models", listKey: "carModels", placeholder: "Add car model…" },
];

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
      <form onSubmit={submit} style={{ display: "flex", gap: 6 }}>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="submit" className="btn-primary" disabled={busy || !val.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}

export default function AttributesSettingsPage() {
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
      <h1>Part attributes</h1>
      <p className="muted" style={{ marginTop: -4 }}>
        Manage the lists behind the product dropdowns (brand · car system · part name). You can also
        type a new value directly on a product — it shows up here.
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
          }}
        >
          {KINDS.map((k) => (
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

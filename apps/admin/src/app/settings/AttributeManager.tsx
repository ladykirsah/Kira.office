"use client";

import { useEffect, useRef, useState } from "react";
import { inputS } from "@/lib/inputStyles";
import {
  fetchAttributes,
  addAttribute,
  deleteAttribute,
  uploadTaxonomyImage,
  clearTaxonomyImage,
  imageUrl,
  type AttrKind,
  type AttrOption,
  type Attributes,
} from "@/lib/api";
import { PageHeader } from "../PageHeader";
import { useToast } from "../ToastProvider";
import { ConfirmButton, XIcon } from "../ConfirmButton";

export interface AttrKindConfig {
  kind: AttrKind;
  label: string;
  listKey: keyof Attributes;
  placeholder: string;
  /** Show a cover-image picker per row — only kinds the storefront renders tiles for. */
  cover?: "type" | "car-brand";
}

/** Square thumbnail + upload / remove for one taxonomy row's storefront cover image. */
export function CoverPicker({
  kind,
  option,
  onChanged,
}: {
  kind: "type" | "car-brand";
  option: AttrOption;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadTaxonomyImage(kind, option.id, file);
      await onChanged();
      toast(`Cover set for “${option.name}” ✓`, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await clearTaxonomyImage(kind, option.id);
      await onChanged();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={option.imageKey ? "Replace cover image" : "Add cover image"}
        aria-label={`${option.imageKey ? "Replace" : "Add"} cover image for ${option.name}`}
        style={{
          width: 34,
          height: 34,
          padding: 0,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          cursor: busy ? "default" : "pointer",
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          fontSize: 15,
          lineHeight: 1,
        }}
      >
        {option.imageKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(option.imageKey)}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span aria-hidden="true" className="muted">
            ＋
          </span>
        )}
      </button>
      {option.imageKey && (
        <ConfirmButton
          className="icon-btn"
          ariaLabel={`Remove cover image for ${option.name}`}
          confirmLabel="Remove image?"
          onConfirm={remove}
        >
          <XIcon />
        </ConfirmButton>
      )}
    </span>
  );
}

function ListCard({
  label,
  placeholder,
  items,
  cover,
  onAdd,
  onDelete,
  onChanged,
}: {
  label: string;
  placeholder: string;
  items: AttrOption[];
  cover?: "type" | "car-brand";
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onChanged: () => Promise<void>;
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
        padding: 16,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 10 }}>{label}</div>
      {items.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
          No values yet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 0, marginBottom: 12 }}>
          {items.map((o) => (
            <div
              key={o.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                borderTop: "1px solid var(--border)",
                padding: "8px 0",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                {cover && <CoverPicker kind={cover} option={o} onChanged={onChanged} />}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</span>
              </span>
              <ConfirmButton
                className="icon-btn"
                ariaLabel={`Remove ${o.name}`}
                confirmLabel="Remove?"
                onConfirm={() => onDelete(o.id)}
              >
                <XIcon />
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
      <PageHeader title={title} subtitle={subtitle} />

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
              cover={k.cover}
              onChanged={load}
              onAdd={(name) => add(k.kind, name)}
              onDelete={(id) => del(k.kind, id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

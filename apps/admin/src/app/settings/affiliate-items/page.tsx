"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchAffiliateItems,
  addAffiliateItem,
  updateAffiliateItem,
  uploadAffiliateItemImage,
  deleteAffiliateItem,
  imageUrl,
  type AffiliateItemRow,
  type AffiliateItemWithStats,
} from "@/lib/api";
import { PageHeader } from "../../PageHeader";
import { useToast } from "../../ToastProvider";
import { ConfirmButton } from "../../ConfirmButton";
import { inputS } from "@/lib/inputStyles";

// Card frame shared by the sections (same look as the Service Setup page).
const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "14px 16px",
} as const;
const cardLabel = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginBottom: 12,
} as const;
const fieldCol = { display: "flex", flexDirection: "column", gap: 4 } as const;
const fieldLabel = { fontSize: 12, color: "var(--text-muted)" } as const;

const SOURCE_LABELS: Record<AffiliateItemRow["source"], string> = {
  shopee: "Shopee",
  lazada: "Lazada",
  other: "Other",
};

const isHttps = (url: string) => /^https:\/\/.+/.test(url.trim());

const TrashIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

function AffiliateItem({
  item,
  onChanged,
}: {
  item: AffiliateItemWithStats;
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function toggle(active: boolean) {
    try {
      await updateAffiliateItem(item.id, { status: active ? "active" : "disabled" });
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadAffiliateItemImage(item.id, file);
      toast("Image uploaded", "success");
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function del() {
    try {
      await deleteAffiliateItem(item.id);
      toast("Item deleted", "success");
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <tr>
      {/* 60px thumb (or a muted "none" frame until an image is uploaded) */}
      <td>
        <div
          style={{
            width: 60,
            height: 60,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {item.imageKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(item.imageKey)}
              alt={item.title}
              style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>none</span>
          )}
        </div>
      </td>
      <td>
        <div style={{ fontWeight: 600 }}>{item.title}</div>
        <a
          href={item.targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            display: "inline-block",
            maxWidth: 260,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            verticalAlign: "bottom",
          }}
        >
          {item.targetUrl}
        </a>
      </td>
      <td>
        <span className="pill off">{SOURCE_LABELS[item.source]}</span>
      </td>
      <td>{item.priceText || <span className="muted">—</span>}</td>
      <td>{item.sortOrder}</td>
      <td>{item.clicks}</td>
      <td>
        <span className="switch">
          <input
            type="checkbox"
            checked={item.status === "active"}
            aria-label={`${item.title} active`}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span className="slider" />
        </span>
      </td>
      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
        <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn-soft btn-sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Upload
          </button>
          <ConfirmButton
            className="icon-btn"
            ariaLabel={`Delete ${item.title}`}
            confirmLabel="Remove?"
            onConfirm={del}
          >
            <TrashIcon />
          </ConfirmButton>
        </div>
      </td>
    </tr>
  );
}

export default function AffiliateItemsPage() {
  const toast = useToast();
  const [items, setItems] = useState<AffiliateItemWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [priceText, setPriceText] = useState("");
  const [source, setSource] = useState<AffiliateItemRow["source"]>("shopee");
  const [sort, setSort] = useState("0");
  const [busy, setBusy] = useState(false);

  const urlOk = isHttps(targetUrl);
  const canAdd = title.trim() !== "" && urlOk;

  async function load() {
    try {
      setItems(await fetchAffiliateItems());
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    setBusy(true);
    try {
      await addAffiliateItem({
        title: title.trim(),
        targetUrl: targetUrl.trim(),
        priceText: priceText.trim() || undefined,
        source,
        sortOrder: Math.round(parseFloat(sort) || 0),
      });
      toast("Item added — upload its image in the table below", "success");
      setTitle("");
      setTargetUrl("");
      setPriceText("");
      setSort("0");
      await load();
    } catch (e2) {
      toast((e2 as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);

  return (
    <main>
      <PageHeader
        title="Affiliate tools"
        subtitle="Mechanic-tool cards on the AirPlus storefront that link out to Shopee / Lazada with your affiliate link. The price text is display-only. Clicks are counted per card."
      />

      {/* Frame 1 — add an item */}
      <div style={cardStyle}>
        <div style={cardLabel}>Add an item</div>
        <form
          onSubmit={add}
          style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}
        >
          <div style={{ ...fieldCol, flex: "1 1 170px" }}>
            <span style={fieldLabel}>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Manifold gauge set"
              style={{ ...inputS, minWidth: 0 }}
            />
          </div>
          <div style={{ ...fieldCol, flex: "1 1 220px" }}>
            <span style={fieldLabel}>Target URL (https)</span>
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://s.shopee.co.th/…"
              style={{ ...inputS, minWidth: 0 }}
            />
          </div>
          <div style={fieldCol}>
            <span style={fieldLabel}>Price text</span>
            <input
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              placeholder="e.g. ~฿1,290"
              style={{ ...inputS, width: 110 }}
            />
          </div>
          <div style={fieldCol}>
            <span style={fieldLabel}>Source</span>
            <select
              aria-label="Source"
              value={source}
              onChange={(e) => setSource(e.target.value as AffiliateItemRow["source"])}
              style={inputS}
            >
              <option value="shopee">Shopee</option>
              <option value="lazada">Lazada</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={fieldCol}>
            <span style={fieldLabel}>Sort</span>
            <input
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{ ...inputS, width: 64 }}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={busy || !canAdd}>
            Add
          </button>
        </form>
        {targetUrl.trim() !== "" && !urlOk && (
          <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6, marginBottom: 0 }}>
            The target URL must start with https://
          </p>
        )}
      </div>

      {/* Frame 2 — items table */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={cardLabel}>Items</div>
        {loading ? (
          <p className="muted" style={{ fontSize: 13 }}>
            Loading…
          </p>
        ) : sorted.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            No affiliate items yet. Add one above.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Item</th>
                  <th>Source</th>
                  <th>Price text</th>
                  <th>Sort</th>
                  <th>Clicks</th>
                  <th>Active</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((it) => (
                  <AffiliateItem key={it.id} item={it} onChanged={load} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

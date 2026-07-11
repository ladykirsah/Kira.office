"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchBanners,
  addBanner,
  updateBanner,
  uploadBannerImage,
  deleteBanner,
  imageUrl,
  type BannerRow,
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

const SLOT_LABELS: Record<BannerRow["slot"], string> = {
  hero: "Hero carousel",
  promo: "Promo strip",
};

// datetime-local value ("2026-07-10T14:30") ↔ epoch ms; "" ↔ null (no window bound).
function msToInput(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function inputToMs(v: string): number | null {
  return v ? new Date(v).getTime() : null;
}

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

function BannerItem({
  banner,
  onChanged,
}: {
  banner: BannerRow;
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState(banner.linkUrl ?? "");
  const [sort, setSort] = useState(String(banner.sortOrder));
  const [starts, setStarts] = useState(msToInput(banner.startsAt));
  const [ends, setEnds] = useState(msToInput(banner.endsAt));
  const [busy, setBusy] = useState(false);
  const sortNum = Math.round(parseFloat(sort) || 0);
  const dirty =
    linkUrl.trim() !== (banner.linkUrl ?? "") ||
    sortNum !== banner.sortOrder ||
    inputToMs(starts) !== banner.startsAt ||
    inputToMs(ends) !== banner.endsAt;

  async function save() {
    setBusy(true);
    try {
      await updateBanner(banner.id, {
        linkUrl: linkUrl.trim() || null,
        sortOrder: sortNum,
        startsAt: inputToMs(starts),
        endsAt: inputToMs(ends),
      });
      toast("Banner saved", "success");
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(active: boolean) {
    try {
      await updateBanner(banner.id, { status: active ? "active" : "disabled" });
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadBannerImage(banner.id, file);
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
      await deleteBanner(banner.id);
      toast("Banner deleted", "success");
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <tr>
      {/* 80px image thumb (or a muted "none" frame until an image is uploaded) */}
      <td>
        <div
          style={{
            width: 80,
            height: 45,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {banner.imageKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(banner.imageKey)}
              alt="Banner"
              style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>none</span>
          )}
        </div>
      </td>
      <td>
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="/products/… or https://…"
          aria-label="Link URL"
          style={{ ...inputS, width: 190 }}
        />
      </td>
      <td>
        <input
          type="number"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort order"
          style={{ ...inputS, width: 64 }}
        />
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <input
          type="datetime-local"
          value={starts}
          onChange={(e) => setStarts(e.target.value)}
          aria-label="Starts at"
          style={inputS}
        />
        <span className="muted" style={{ margin: "0 6px" }}>
          –
        </span>
        <input
          type="datetime-local"
          value={ends}
          onChange={(e) => setEnds(e.target.value)}
          aria-label="Ends at"
          style={inputS}
        />
      </td>
      <td>
        <span className="switch">
          <input
            type="checkbox"
            checked={banner.status === "active"}
            aria-label="Banner active"
            onChange={(e) => toggle(e.target.checked)}
          />
          <span className="slider" />
        </span>
      </td>
      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
        <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          {dirty && (
            <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={save}>
              Save
            </button>
          )}
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
            ariaLabel="Delete banner"
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

export default function BannersPage() {
  const toast = useToast();
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slot, setSlot] = useState<BannerRow["slot"]>("hero");
  const [linkUrl, setLinkUrl] = useState("");
  const [sort, setSort] = useState("0");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setBanners(await fetchBanners());
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
    setBusy(true);
    try {
      await addBanner({
        slot,
        linkUrl: linkUrl.trim() || undefined,
        sortOrder: Math.round(parseFloat(sort) || 0),
        startsAt: inputToMs(starts),
        endsAt: inputToMs(ends),
      });
      toast("Banner added — upload its image in the table below", "success");
      setLinkUrl("");
      setSort("0");
      setStarts("");
      setEnds("");
      await load();
    } catch (e2) {
      toast((e2 as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <PageHeader
        title="Banners"
        subtitle="Home-page banners on the AirPlus storefront: the hero carousel and the promo strip. Add a banner, then upload its image. An optional window shows it only between the two dates."
      />

      {/* Frame 1 — add a banner */}
      <div style={cardStyle}>
        <div style={cardLabel}>Add a banner</div>
        <form
          onSubmit={add}
          style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}
        >
          <div style={fieldCol}>
            <span style={fieldLabel}>Slot</span>
            <select
              aria-label="Slot"
              value={slot}
              onChange={(e) => setSlot(e.target.value as BannerRow["slot"])}
              style={inputS}
            >
              <option value="hero">Hero carousel</option>
              <option value="promo">Promo strip</option>
            </select>
          </div>
          <div style={{ ...fieldCol, flex: "1 1 180px" }}>
            <span style={fieldLabel}>Link URL (optional)</span>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="/products/… or https://…"
              style={{ ...inputS, minWidth: 0 }}
            />
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
          <div style={fieldCol}>
            <span style={fieldLabel}>Starts (optional)</span>
            <input
              type="datetime-local"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
              style={inputS}
            />
          </div>
          <div style={fieldCol}>
            <span style={fieldLabel}>Ends (optional)</span>
            <input
              type="datetime-local"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
              style={inputS}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            Add
          </button>
        </form>
      </div>

      {/* Frame 2 — banners grouped by slot */}
      {(["hero", "promo"] as const).map((s) => {
        const rows = banners
          .filter((b) => b.slot === s)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
        return (
          <div key={s} style={{ ...cardStyle, marginTop: 16 }}>
            <div style={cardLabel}>{SLOT_LABELS[s]}</div>
            {loading ? (
              <p className="muted" style={{ fontSize: 13 }}>
                Loading…
              </p>
            ) : rows.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                No {SLOT_LABELS[s].toLowerCase()} banners yet. Add one above.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Link</th>
                      <th>Sort</th>
                      <th>Window</th>
                      <th>Active</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => (
                      <BannerItem key={b.id} banner={b} onChanged={load} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}

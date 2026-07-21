"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  liveWindow,
  SLOT_LIMIT,
  slotCountLabel,
  slotIsFull,
  type BannerSlot,
} from "@/lib/bannerSlots";

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

/** What each frame is, so the owner knows what shape of image to prepare. */
const SLOT_HINT: Record<BannerRow["slot"], string> = {
  hero: "Rotating slides at the top of the home page. Wide 16:6 images work best. Max 3 — slides past the third are rarely seen.",
  promo:
    "A single wide band lower down the home page. Same wide shape; add as many as you like and they stack.",
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
  const [editing, setEditing] = useState(false);
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
      setEditing(false);
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  /** Discard edits and drop back to the plain-text view. */
  function cancelEdit() {
    setLinkUrl(banner.linkUrl ?? "");
    setSort(String(banner.sortOrder));
    setStarts(msToInput(banner.startsAt));
    setEnds(msToInput(banner.endsAt));
    setEditing(false);
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

  /** Saved values shown as plain text; a field only stays an input while it has nothing yet. */
  const savedLink = banner.linkUrl?.trim() ?? "";
  const windowText =
    banner.startsAt == null && banner.endsAt == null
      ? "ตลอดเวลา · until changed"
      : `${banner.startsAt ? new Date(banner.startsAt).toLocaleDateString() : "—"} → ${
          banner.endsAt ? new Date(banner.endsAt).toLocaleDateString() : "—"
        }`;

  const cellText = { fontSize: 13, color: "var(--text)" } as const;
  const cellMuted = { fontSize: 13, color: "var(--text-muted)" } as const;

  return (
    <tr>
      {/* Bigger 16:9 preview filling its frame — the old 80x45 letterbox made it hard to tell
          WHICH image had been uploaded, which is the point of this column. */}
      <td>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title="Replace image"
          aria-label="Replace banner image"
          style={{
            width: 132,
            height: 74,
            padding: 0,
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--surface)",
            overflow: "hidden",
            cursor: busy ? "default" : "pointer",
            display: "block",
          }}
        >
          {banner.imageKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(banner.imageKey)}
              alt="Banner"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>no image</span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </td>

      {editing ? (
        <>
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
        </>
      ) : (
        <>
          {/* Saved -> plain text. An empty link keeps its input so it can be filled without
              entering edit mode; sort and window always have a value to show. */}
          <td>
            {savedLink ? (
              <span style={cellText}>{savedLink}</span>
            ) : (
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="/products/… or https://…"
                aria-label="Link URL"
                style={{ ...inputS, width: 190 }}
              />
            )}
          </td>
          <td>
            <span style={cellText}>{banner.sortOrder}</span>
          </td>
          <td style={{ whiteSpace: "nowrap" }}>
            <span style={banner.startsAt == null && banner.endsAt == null ? cellMuted : cellText}>
              {windowText}
            </span>
          </td>
        </>
      )}

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
          {editing ? (
            <>
              <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={save}>
                Save
              </button>
              <button type="button" className="btn-sm" disabled={busy} onClick={cancelEdit}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {dirty && (
                <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={save}>
                  Save
                </button>
              )}
              <button
                type="button"
                className="btn-soft btn-sm"
                disabled={busy}
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            </>
          )}
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

/**
 * Add-form for ONE slot. Each slot owns its own form because the two frames are different shapes,
 * so their guidance and limits differ.
 *
 * The image is picked HERE rather than uploaded afterwards: the previous flow created the banner
 * first and left it imageless until a second step, which meant a half-made banner could sit in the
 * list looking broken. Create + upload now happen in one submit, and the image is required.
 */
function AddBannerForm({
  slot,
  count,
  onAdded,
}: {
  slot: BannerSlot;
  count: number;
  onAdded: () => Promise<void>;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [liveTime, setLiveTime] = useState(false);
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const full = slotIsFull(slot, count);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (full) return;
    if (!file) {
      setError("เลือกรูปแบนเนอร์ก่อน — a banner without an image renders nothing.");
      fileRef.current?.click();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { startsAt, endsAt } = liveWindow(liveTime, starts, ends);
      // Sort to the end of this slot; order is edited per row afterwards.
      const { id } = await addBanner({
        slot,
        linkUrl: linkUrl.trim() || undefined,
        sortOrder: count,
        startsAt,
        endsAt,
      });
      await uploadBannerImage(id, file);
      toast(`เพิ่ม${SLOT_LABELS[slot]}แล้ว ✓`, "success");
      setFile(null);
      setLinkUrl("");
      setLiveTime(false);
      setStarts("");
      setEnds("");
      if (fileRef.current) fileRef.current.value = "";
      await onAdded();
    } catch (e2) {
      // Reload either way: the banner row may exist even if the image upload failed, and the list
      // must show what actually landed rather than a stale view.
      await onAdded();
      setError((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (full) {
    return (
      <p className="muted" style={{ fontSize: 13, margin: "0 0 4px" }}>
        {SLOT_LABELS[slot]} is full ({slotCountLabel(slot, count)}). Remove one below to add
        another.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={fieldCol}>
          <span style={fieldLabel}>Banner image</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              ...inputS,
              maxWidth: 230,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {file ? `🖼 ${file.name}` : "＋ Choose image…"}
          </button>
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
        <button type="submit" className="btn-primary btn-sm" disabled={busy}>
          {busy ? "Adding…" : "Add"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {/* Same .switch/.slider control as the Active toggle on each row below, and as every other
            switch in the admin — not a bespoke one. */}
        <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
          <span className="switch">
            <input
              type="checkbox"
              checked={liveTime}
              disabled={busy}
              aria-label="Live time"
              onChange={(e) => setLiveTime(e.target.checked)}
            />
            <span className="slider" />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Live time</span>
        </label>
        <span className="muted" style={{ fontSize: 12 }}>
          {liveTime
            ? "Shows only between the two dates below."
            : "Off — goes live now and stays until you change it."}
        </span>
      </div>

      {liveTime && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={fieldCol}>
            <span style={fieldLabel}>Starts</span>
            <input
              type="datetime-local"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
              style={inputS}
            />
          </div>
          <div style={fieldCol}>
            <span style={fieldLabel}>Ends</span>
            <input
              type="datetime-local"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
              style={inputS}
            />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" style={{ color: "var(--danger, #bf3c1d)", fontSize: 12, margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  );
}

export default function BannersPage() {
  const toast = useToast();
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setBanners(await fetchBanners());
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <PageHeader
        title="Banners"
        subtitle="Home-page banners on the AirPlus storefront. The hero carousel and the promo strip are different frames, so each is set up separately below."
      />

      {(["hero", "promo"] as const).map((s) => {
        const rows = banners
          .filter((b) => b.slot === s)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
        return (
          <div key={s} style={{ ...cardStyle, marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
              <div style={{ ...cardLabel, marginBottom: 0 }}>{SLOT_LABELS[s]}</div>
              <span className="muted" style={{ fontSize: 12 }}>
                {slotCountLabel(s, rows.length)}
              </span>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: "0 0 14px" }}>
              {SLOT_HINT[s]}
            </p>

            {/* Capacity is shown as explicit slide slots rather than implied by a form that simply
                reappears. Without this the owner cannot tell WHERE slides 2 and 3 go, or how many
                are left — the count alone reads as a limit, not as remaining room. */}
            {SLOT_LIMIT[s] !== null && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {Array.from({ length: SLOT_LIMIT[s] as number }, (_, i) => {
                  const filled = i < rows.length;
                  return (
                    <div
                      key={i}
                      style={{
                        flex: "1 1 120px",
                        minWidth: 110,
                        padding: "8px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: "center",
                        border: filled ? "1px solid var(--border)" : "1px dashed var(--text-muted)",
                        background: filled ? "var(--surface)" : "transparent",
                        color: filled ? "var(--text)" : "var(--text-muted)",
                      }}
                    >
                      {filled ? `✓ Slide ${i + 1}` : `Slide ${i + 1} — empty`}
                    </div>
                  );
                })}
              </div>
            )}

            <AddBannerForm slot={s} count={rows.length} onAdded={load} />

            <div style={{ marginTop: 16 }}>
              {loading ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  Loading…
                </p>
              ) : rows.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  No {SLOT_LABELS[s].toLowerCase()} banners yet.
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
          </div>
        );
      })}
    </main>
  );
}

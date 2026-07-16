"use client";

import { useEffect, useState } from "react";
import {
  fetchCampaigns,
  addCampaign,
  updateCampaign,
  deleteCampaign,
  addCampaignPrice,
  deleteCampaignPrice,
  searchVariants,
  type CampaignRow,
  type VariantSearchResult,
} from "@/lib/api";
import { formatBahtTrim, formatUpdatedAt } from "@/lib/format";
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

// datetime-local value ↔ epoch ms; "" ↔ null.
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

/** Debounced product picker + sale-price/cap inputs → POST a campaign price. */
function AddProductRow({
  campaign,
  onChanged,
}: {
  campaign: CampaignRow;
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<VariantSearchResult[]>([]);
  const [picked, setPicked] = useState<VariantSearchResult | null>(null);
  const [salePrice, setSalePrice] = useState("");
  const [cap, setCap] = useState("");
  const [busy, setBusy] = useState(false);

  // Debounce the variant search 300ms behind typing; a pick clears the dropdown.
  useEffect(() => {
    const term = q.trim();
    if (!term || picked) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchVariants(term)
        .then(setResults)
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q, picked]);

  const salePriceSatang = Math.max(0, Math.round((parseFloat(salePrice) || 0) * 100));
  const capNum = cap.trim() ? Math.max(1, Math.round(parseFloat(cap))) : undefined;
  const alreadyIn =
    picked != null && campaign.prices.some((p) => p.productVariantId === picked.variantId);
  const canAdd = picked != null && salePriceSatang > 0 && !alreadyIn;

  async function add() {
    if (!picked || !canAdd) return;
    setBusy(true);
    try {
      await addCampaignPrice(campaign.id, {
        productVariantId: picked.variantId,
        campaignPriceSatang: salePriceSatang,
        stockCap: capNum,
      });
      toast("Product added to campaign", "success");
      setQ("");
      setPicked(null);
      setSalePrice("");
      setCap("");
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ ...fieldCol, flex: "1 1 220px", position: "relative" }}>
          <span style={fieldLabel}>Add product</span>
          {picked ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="pill soft">
                {picked.name} · {picked.productRef}
              </span>
              <button
                type="button"
                className="btn-sm"
                onClick={() => {
                  setPicked(null);
                  setQ("");
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search product name / ID…"
                aria-label="Search products"
                style={{ ...inputS, minWidth: 0 }}
              />
              {results.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    marginTop: 4,
                    maxHeight: 240,
                    overflowY: "auto",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                >
                  {results.map((r) => (
                    <button
                      key={r.variantId}
                      type="button"
                      onClick={() => {
                        setPicked(r);
                        setResults([]);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {r.productRef} · online {formatBahtTrim(r.onlinePriceSatang)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div style={fieldCol}>
          <span style={fieldLabel}>Sale price (฿)</span>
          <input
            type="number"
            min={0}
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            placeholder="0"
            style={{ ...inputS, width: 100 }}
          />
        </div>
        <div style={fieldCol}>
          <span style={fieldLabel}>Stock cap (optional)</span>
          <input
            type="number"
            min={1}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            placeholder="∞"
            style={{ ...inputS, width: 90 }}
          />
        </div>
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={busy || !canAdd}
          onClick={add}
        >
          Add
        </button>
      </div>
      {alreadyIn && (
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          This product is already in the campaign.
        </p>
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  onChanged,
}: {
  campaign: CampaignRow;
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const now = Date.now();
  const live = campaign.status === "active" && now >= campaign.startsAt && now < campaign.endsAt;

  async function toggle(active: boolean) {
    try {
      await updateCampaign(campaign.id, { status: active ? "active" : "disabled" });
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function del() {
    try {
      await deleteCampaign(campaign.id);
      toast("Campaign deleted", "success");
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function removePrice(priceId: string) {
    try {
      await deleteCampaignPrice(campaign.id, priceId);
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div style={{ ...cardStyle, marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>{campaign.name}</div>
        {live && <span className="pill good">LIVE NOW</span>}
        {campaign.status === "disabled" && <span className="pill off">Disabled</span>}
        <span className="muted" style={{ fontSize: 13 }}>
          {formatUpdatedAt(campaign.startsAt)} → {formatUpdatedAt(campaign.endsAt)}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <span className="switch">
            <input
              type="checkbox"
              checked={campaign.status === "active"}
              aria-label={`Campaign ${campaign.name} active`}
              onChange={(e) => toggle(e.target.checked)}
            />
            <span className="slider" />
          </span>
          <ConfirmButton
            className="icon-btn"
            ariaLabel={`Delete ${campaign.name}`}
            confirmLabel="Remove?"
            onConfirm={del}
          >
            <TrashIcon />
          </ConfirmButton>
        </div>
      </div>

      {campaign.prices.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          No products in this campaign yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Base</th>
                <th>Sale</th>
                <th>Cap</th>
                <th>Sold</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {campaign.prices.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.productName}</div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{p.productRef}</div>
                  </td>
                  <td>{formatBahtTrim(p.basePriceSatang)}</td>
                  <td>
                    <span className="pill good">{formatBahtTrim(p.campaignPriceSatang)}</span>
                  </td>
                  <td>{p.stockCap ?? <span className="muted">∞</span>}</td>
                  <td>{p.soldCount}</td>
                  <td style={{ textAlign: "right" }}>
                    <ConfirmButton
                      className="icon-btn"
                      ariaLabel={`Remove ${p.productName}`}
                      confirmLabel="Remove?"
                      onConfirm={() => removePrice(p.id)}
                    >
                      <TrashIcon />
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddProductRow campaign={campaign} onChanged={onChanged} />
    </div>
  );
}

export default function CampaignsPage() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [busy, setBusy] = useState(false);

  const startsMs = inputToMs(starts);
  const endsMs = inputToMs(ends);
  const canAdd = name.trim() !== "" && startsMs != null && endsMs != null && endsMs > startsMs;

  async function load() {
    try {
      setCampaigns(await fetchCampaigns());
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
    if (!canAdd || startsMs == null || endsMs == null) return;
    setBusy(true);
    try {
      await addCampaign({ name: name.trim(), startsAt: startsMs, endsAt: endsMs });
      toast("Campaign added — now add its products", "success");
      setName("");
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
        title="Flash sales"
        subtitle="Timed sale-price campaigns on the AirPlus storefront. Each campaign has a window and a list of products with a sale price (and an optional per-product stock cap). Prices apply automatically while the window is open."
      />

      {/* Frame 1 — add a campaign */}
      <div style={cardStyle}>
        <div style={cardLabel}>Add a campaign</div>
        <form
          onSubmit={add}
          style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}
        >
          <div style={{ ...fieldCol, flex: "1 1 180px" }}>
            <span style={fieldLabel}>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 9.9 Flash Sale"
              style={{ ...inputS, minWidth: 0 }}
            />
          </div>
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
          <button type="submit" className="btn-primary" disabled={busy || !canAdd}>
            Add
          </button>
        </form>
      </div>

      {/* Campaign cards */}
      {loading ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
          Loading…
        </p>
      ) : campaigns.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
          No campaigns yet. Add one above.
        </p>
      ) : (
        campaigns.map((c) => <CampaignCard key={c.id} campaign={c} onChanged={load} />)
      )}
    </main>
  );
}

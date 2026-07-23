"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lookupBarcode } from "@/lib/api";
import { PageHeader } from "../PageHeader";
import { BackLink } from "../BackLink";
import { useToast } from "../ToastProvider";
import { ScanInput } from "./ScanInput";
import { BarcodePreview } from "../products/BarcodePreview";

type Mode = "add" | "view" | "hold" | "fill" | "pos";

const MODES: {
  key: Mode;
  icon: string;
  title: string;
  desc: string;
  ready: boolean;
}[] = [
  {
    key: "add",
    icon: "🆕",
    title: "Add new product",
    desc: "Scan a part to start a new listing.",
    ready: true,
  },
  { key: "view", icon: "🔍", title: "View product", desc: "Scan to open a product.", ready: true },
  {
    key: "hold",
    icon: "⏸️",
    title: "On hold",
    desc: "Move stock to or from the hold.",
    ready: false,
  },
  {
    key: "fill",
    icon: "📥",
    title: "Fill stock",
    desc: "Receive stock into on hand.",
    ready: false,
  },
  { key: "pos", icon: "🧾", title: "POS", desc: "Scan items to build a bill.", ready: false },
];

const card = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "16px 18px",
  background: "var(--surface)",
} as const;

/**
 * "Scan here" — one shortcut page for every barcode task. Opens on a menu of five modes; the mode
 * picked drives what happens with each scan. Add and View hand off to an existing page; On hold,
 * Fill stock and POS finish on this page (built in later steps).
 */
export default function ScanPage() {
  const [mode, setMode] = useState<Mode | null>(null);

  return (
    <main>
      <PageHeader
        title="Scan here"
        subtitle={
          mode === null
            ? "Pick what you're scanning for."
            : (MODES.find((m) => m.key === mode)?.title ?? "")
        }
        below={
          mode === null ? undefined : (
            <BackLink onClick={() => setMode(null)}>All scan modes</BackLink>
          )
        }
      />
      {mode === null ? (
        <ModeMenu onPick={setMode} />
      ) : mode === "add" ? (
        <AddMode />
      ) : mode === "view" ? (
        <ViewMode />
      ) : (
        <ComingSoon title={MODES.find((m) => m.key === mode)?.title ?? ""} />
      )}
    </main>
  );
}

function ModeMenu({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
        gap: 14,
      }}
    >
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => onPick(m.key)}
          disabled={!m.ready}
          title={m.ready ? m.title : "Coming soon"}
          style={{
            ...card,
            textAlign: "left",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            cursor: m.ready ? "pointer" : "not-allowed",
            opacity: m.ready ? 1 : 0.55,
          }}
        >
          <span style={{ fontSize: 26, lineHeight: 1 }}>{m.icon}</span>
          <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              {m.title}
              {!m.ready && <span className="pill off">Soon</span>}
            </span>
            <span className="muted" style={{ fontSize: 13 }}>
              {m.desc}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Add new product: scan one code, then hand off to the new-product form with it pre-filled. */
function AddMode() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 460 }}>
      <ScanInput onScan={setCode} buttonLabel="Scan" placeholder="Scan a new part's barcode…" />
      {code && (
        <div style={{ ...card, display: "grid", gap: 12 }}>
          {/* The scanned code is both the Product ID and the barcode source — one identifier. */}
          <div style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Product ID / barcode
            </span>
            <strong style={{ fontSize: 18 }}>{code}</strong>
          </div>
          <BarcodePreview value={code} />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => router.push(`/products/new?ref=${encodeURIComponent(code)}`)}
            >
              Add
            </button>
            <button type="button" onClick={() => setCode(null)}>
              Scan another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** View product: scan one code, look it up, and open its detail page. */
function ViewMode() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function open(rawCode: string) {
    setBusy(true);
    try {
      const found = await lookupBarcode(rawCode);
      if (!found) {
        toast(`No product found for ${rawCode}`, "error");
        return;
      }
      router.push(`/products/${found.productId}`);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 460 }}>
      <ScanInput
        onScan={open}
        buttonLabel="Open"
        disabled={busy}
        placeholder="Scan a product's barcode…"
      />
      <p className="muted" style={{ fontSize: 13 }}>
        Scanning opens the product in view mode.
      </p>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div style={{ ...card, maxWidth: 460 }}>
      <p style={{ margin: 0 }}>
        <strong>{title}</strong> is being built.
      </p>
      <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
        This mode will finish on this page — scanning multiple items, then a submit.
      </p>
    </div>
  );
}

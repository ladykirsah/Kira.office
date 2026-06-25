"use client";

import { useEffect, useState } from "react";
import { fetchShopInfo, saveShopInfo } from "@/lib/api";
import { useToast } from "../../ToastProvider";

const labelStyle = { fontSize: 13, color: "var(--text-muted)", marginBottom: 4 } as const;

export default function ShopInfoPage() {
  const toast = useToast();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchShopInfo()
      .then((s) => {
        setName(s.name);
        setAddress(s.address);
      })
      .catch((e) => toast((e as Error).message, "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setBusy(true);
    try {
      await saveShopInfo({ name: name.trim(), address: address.trim() });
      toast("Shop info saved", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Shop info</h1>
      <p className="muted">
        Your shop name and address. Shown on printed bills and as the header on barcode labels.
      </p>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "16px 18px",
          maxWidth: 520,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div>
          <div style={labelStyle}>Shop name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Den Air Service (Surin)"
            disabled={loading}
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <div style={labelStyle}>Address</div>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            placeholder="e.g. 123 ถนนหลักเมือง อ.เมือง จ.สุรินทร์ 32000"
            disabled={loading}
            style={{ width: "100%", fontFamily: "inherit" }}
          />
        </div>
        <div>
          <button type="button" className="btn-primary" disabled={busy || loading} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </main>
  );
}

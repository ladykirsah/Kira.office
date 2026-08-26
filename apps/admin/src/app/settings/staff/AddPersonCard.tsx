"use client";

import { useState } from "react";
import { useToast } from "../../ToastProvider";
import { useT } from "../../LangProvider";
import { ROLE_LABEL } from "@/lib/roleLabel";

const ROLES = ["super_admin", "admin", "mechanic"] as const;

// Same alphabet the API generates from: no I, l, 1, O or 0, because the owner reads these out loud
// or types them into a chat message.
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generate(): string {
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return [...bytes].map((n) => ALPHABET[n % ALPHABET.length]).join("");
}

export function AddPersonCard({ onDone }: { onDone: (name: string) => void }) {
  const [nameTh, setNameTh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("mechanic");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const t = useT();

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/worker/staff", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // The list shows one name; the Thai one is what the shop actually calls them.
          name: nameTh.trim() || nameEn.trim(),
          nameTh: nameTh.trim() || null,
          nameEn: nameEn.trim() || null,
          email: email.trim(),
          role,
          password: password || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(
          data.error || t({ th: "สร้างบัญชีไม่สำเร็จ", en: "Couldn't create that account." }),
          "error",
        );
        return;
      }
      onDone(nameTh.trim() || nameEn.trim() || email);
    } catch {
      toast(t({ th: "ติดต่อเซิร์ฟเวอร์ไม่ได้", en: "Couldn't reach the server." }), "error");
    } finally {
      setBusy(false);
    }
  }

  const ready = (nameTh.trim() || nameEn.trim()) && email.trim() && password.length >= 8;

  return (
    <div className="card" style={{ marginBottom: 16, maxWidth: 560 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>{t({ th: "เพิ่มคน", en: "Add person" })}</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="login-label" htmlFor="nameTh">
            {t({ th: "ชื่อ (ภาษาไทย)", en: "Name (Thai)" })}
          </label>
          <input
            id="nameTh"
            value={nameTh}
            onChange={(e) => setNameTh(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="login-label" htmlFor="nameEn">
            {t({ th: "ชื่อ (ภาษาอังกฤษ)", en: "Name (English)" })}
          </label>
          <input
            id="nameEn"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label className="login-label" htmlFor="email">
          {t({ th: "อีเมล — ใช้เป็นชื่อผู้ใช้ของเขา", en: "Email — this is their username" })}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label className="login-label" htmlFor="role">
          {t({ th: "ตำแหน่ง", en: "Role" })}
        </label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(ROLE_LABEL[r]!)}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="login-label" htmlFor="password">
          {t({ th: "รหัสผ่าน", en: "Password" })}
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <button type="button" className="btn-soft" onClick={() => setPassword(generate())}>
            {t({ th: "สุ่มให้", en: "Generate" })}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
          {t({
            th: "เปิดดูย้อนหลังได้ตลอดที่ จัดการ → ดูรหัสผ่าน",
            en: "You can read this back any time from Actions → Show password.",
          })}
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" className="btn-primary" disabled={!ready || busy} onClick={create}>
          {busy
            ? t({ th: "กำลังสร้าง…", en: "Creating…" })
            : t({ th: "สร้างบัญชี", en: "Create account" })}
        </button>
      </div>
    </div>
  );
}

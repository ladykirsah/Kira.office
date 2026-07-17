"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { displayNameError } from "@l-shopee/core";
import { formatThaiPhone, normalizePhone } from "@/lib/format";

/**
 * The member card: who you are, and the two things you must be able to fix yourself.
 *
 * Before this, neither was possible. Registration never asked for a name, checkout captured one
 * exactly once (`WHERE name = ''`) and nothing could ever change it — so a customer who typed "L"
 * at their first checkout was called "L" forever. The phone had no editing path at all.
 *
 * The two edits are deliberately asymmetric, because one is a label and the other is a credential:
 *  • Name  — a plain field. Wrong name costs nothing but embarrassment; save and move on.
 *  • Phone — a two-step flow gated on an OTP sent to the NEW number. It is the login AND the key
 *    guest order tracking resolves orders by, so changing it without proving ownership would hand
 *    someone an account and its entire order history.
 */
export function ProfileCard({
  name,
  phone,
  birthday,
}: {
  name: string;
  phone: string;
  // Pre-formatted Thai birthday ("20 มีนาคม 2540"), or null when the account has no DOB on file —
  // the line is simply omitted rather than showing an empty "วันเกิด".
  birthday?: string | null;
}) {
  const router = useRouter();
  // "edit" holds BOTH fields, because owner-picked Design B has a single แก้ไข button; "phone" is
  // the OTP sub-flow nested inside it, kept separate so a half-finished phone change can never be
  // saved by the name form's submit.
  const [mode, setMode] = useState<null | "edit" | "phone">(null);
  const [nameInput, setNameInput] = useState(name);
  const [phoneInput, setPhoneInput] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const reset = () => {
    setMode(null);
    setErr(null);
    setCode("");
    setPhoneInput("");
    setCodeSent(false);
  };

  async function saveName() {
    const problem = displayNameError(nameInput);
    if (problem) {
      setErr(problem);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nameInput }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "บันทึกไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      setOk("บันทึกชื่อแล้ว");
      reset();
      router.refresh();
    } catch {
      setErr("ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Ask for a code on the NEW number. mode:'register' is exactly right here and not a hack: it is
   * the server's existing "this number must not already have an account" gate, so a code is never
   * sent to a number that belongs to someone else.
   */
  async function sendCode() {
    const next = normalizePhone(phoneInput);
    if (next.length < 9 || next.length > 10) {
      setErr("กรุณากรอกเบอร์โทรศัพท์ 9-10 หลัก");
      return;
    }
    if (next === normalizePhone(phone)) {
      setErr("เป็นเบอร์เดิมของคุณอยู่แล้ว");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: next, mode: "register" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        alreadyRegistered?: boolean;
      };
      if (!res.ok) {
        setErr(
          data.alreadyRegistered
            ? "เบอร์นี้มีบัญชีอื่นใช้อยู่แล้ว"
            : (data.error ?? "ส่งรหัสไม่สำเร็จ กรุณาลองใหม่"),
        );
        return;
      }
      setCodeSent(true);
    } catch {
      setErr("ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  async function savePhone() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/phone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: normalizePhone(phoneInput), code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "เปลี่ยนเบอร์ไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      setOk("เปลี่ยนเบอร์โทรแล้ว");
      reset();
      router.refresh();
    } catch {
      setErr("ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="acct-profile">
      {mode === null && (
        <>
          {/* Design B (owner-picked), without the avatar: the name IS the card. A customer who has
              not given a name yet gets an invitation instead of a blank — the one thing this card
              exists to fix. */}
          <div className="acct-profile-id">
            <div className="acct-profile-name">
              {name || <span className="acct-profile-empty">ยังไม่ได้ระบุชื่อ</span>}
            </div>
            <div className="acct-profile-phone">{formatThaiPhone(phone)}</div>
            {birthday && (
              <div className="acct-profile-dob">
                <span className="acct-profile-dob-k">วันเกิด</span>
                {birthday}
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-s btn-outline btn-primary"
            onClick={() => {
              setNameInput(name);
              setMode("edit");
              setOk(null);
            }}
          >
            {name ? "แก้ไข" : "เพิ่มชื่อ"}
          </button>
        </>
      )}

      {mode === "edit" && (
        <form
          style={{ display: "grid", gap: 10, width: "100%" }}
          onSubmit={(e) => {
            e.preventDefault();
            void saveName();
          }}
        >
          {/* ยกเลิก/บันทึก sit directly under the field they act on. They only ever save the NAME —
              below the phone row they read as if they saved the phone too, which they never did. */}
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="pf-name">ชื่อ-นามสกุล</label>
            <input
              id="pf-name"
              className="input"
              autoComplete="name"
              placeholder="เช่น สมชาย ใจดี"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
          </div>
          {err && <ErrorLine msg={err} />}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              onClick={reset}
              disabled={busy}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
          {/* The phone lives in the same panel because Design B has one button — but it is a
              credential, so it hands off to its own OTP flow rather than being saved above. Below
              the divider it reads as its own separate thing, which is exactly what it is. */}
          <div className="acct-profile-phonerow">
            <div>
              <div className="acct-profile-k">เบอร์โทร (ใช้เข้าสู่ระบบ)</div>
              <div className="acct-profile-v">{formatThaiPhone(phone)}</div>
            </div>
            <button
              type="button"
              className="btn btn-s btn-text btn-default"
              onClick={() => {
                setMode("phone");
                setErr(null);
              }}
            >
              เปลี่ยนเบอร์
            </button>
          </div>
        </form>
      )}

      {mode === "phone" && (
        <form
          style={{ display: "grid", gap: 10, width: "100%" }}
          onSubmit={(e) => {
            e.preventDefault();
            void (codeSent ? savePhone() : sendCode());
          }}
        >
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            เบอร์นี้ใช้เข้าสู่ระบบและใช้ติดตามคำสั่งซื้อ —
            เราจะส่งรหัสไปที่เบอร์ใหม่เพื่อยืนยันว่าเป็นของคุณ
          </p>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="pf-phone">เบอร์โทรใหม่</label>
            <input
              id="pf-phone"
              className="input"
              type="tel"
              inputMode="tel"
              placeholder="08XXXXXXXX"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              disabled={codeSent}
            />
          </div>
          {codeSent && (
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="pf-code">รหัส 6 หลักที่ส่งไปยังเบอร์ใหม่</label>
              <input
                id="pf-code"
                className="input"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          )}
          {err && <ErrorLine msg={err} />}
          <div style={{ display: "flex", gap: 8 }}>
            {/* Back to the edit panel this was opened from — not out to the card, which would throw
                away a name the customer had already typed. */}
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              onClick={() => {
                setMode("edit");
                setErr(null);
                setCode("");
                setPhoneInput("");
                setCodeSent(false);
              }}
              disabled={busy}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={busy || (codeSent && code.length !== 6)}
            >
              {busy ? "กำลังดำเนินการ…" : codeSent ? "ยืนยันเปลี่ยนเบอร์" : "ส่งรหัสยืนยัน"}
            </button>
          </div>
        </form>
      )}

      {/* Confirmation of the last save. Lives outside the branches above so it survives the card
          returning to its resting state — otherwise the save would appear to do nothing at all. */}
      {mode === null && ok && (
        <div role="status" className="acct-profile-ok">
          {ok}
        </div>
      )}
    </div>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <div role="alert" style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600 }}>
      {msg}
    </div>
  );
}

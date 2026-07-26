"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { inputL, inputS } from "@/lib/inputStyles";
import { cmToMm } from "@/lib/parcel";
import {
  saveFullProduct,
  adjustStock,
  uploadGalleryImage,
  fetchAttributes,
  fetchCarFitment,
  checkIdentifier,
  type Attributes,
  type Fitment,
  type CarBrandTree,
  type IdentifierKind,
  type FullProductInput,
} from "@/lib/api";
import { PageHeader } from "../../PageHeader";
import { useToast } from "../../ToastProvider";
import { carrySummary, clearedProductFields } from "@/lib/batchAdd";
import { missingRequiredToSave, shouldAutosaveDraft } from "@/lib/newProduct";
import { uploadBufferInOrder, type BufferPhoto } from "@/lib/photoBuffer";
import { PartDetails, type PartForm } from "../PartDetails";
import { ProductGallery } from "../ProductGallery";
import { PricingFields, type PricingForm, toSatang } from "../PricingFields";
import { FitmentSection } from "../FitmentSection";
import { buildProductName, canBuildProductName } from "@l-shopee/core";

const field = { display: "grid", gap: 4 } as const;

/** Debounced check: warn if another product (any status) already uses this Product ID / barcode / Shopee ID. */
function useIdentifierCheck(kind: IdentifierKind, value: string): string | null {
  const [warn, setWarn] = useState<string | null>(null);
  useEffect(() => {
    const v = value.trim();
    if (!v) {
      setWarn(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const m = await checkIdentifier(kind, v);
        if (!cancelled) {
          setWarn(m ? `Already used by “${m.name}” (${m.productRef} · ${m.status})` : null);
        }
      } catch {
        if (!cancelled) setWarn(null);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [kind, value]);
  return warn;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/** Add product — same sections as the editor (photos, description, part details, fitments, pricing).
 *  Work auto-saves as a draft in the background (so nothing is lost between sessions); the explicit
 *  "Publish" button makes it active. Photos are held locally and uploaded on Publish. */
export default function NewProductPage() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [weightKg, setWeightKg] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [part, setPart] = useState<PartForm>({ brand: "", usage: "", type: "" });
  const [fitments, setFitments] = useState<Fitment[]>([]);
  const [carTree, setCarTree] = useState<CarBrandTree[]>([]);
  const [productRef, setProductRef] = useState("");
  const [shopeeItemId, setShopeeItemId] = useState("");
  const [pricing, setPricing] = useState<PricingForm>({
    costThb: "",
    taxOnCost: false,
    b2cThb: "",
    b2bThb: "",
    onlineThb: "",
    onlineCommPct: "",
  });
  const [attributes, setAttributes] = useState<Attributes | null>(null);
  // Photos picked before the product exists — held locally and uploaded on Save (any order).
  const [photos, setPhotos] = useState<BufferPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  // Batch listing: products saved in this visit (drives the counter + pill).
  const [savedCount, setSavedCount] = useState(0);
  const nameRef = useRef<HTMLInputElement | null>(null);
  // Background draft auto-save: the row we've created (so later saves update it by id, not by ref —
  // renaming the Product ID mid-typing can't orphan drafts), the last-saved signature (skip no-op
  // writes) and a small status for the indicator.
  const autoSavedId = useRef<string | null>(null);
  const lastSavedSig = useRef<string>("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    fetchAttributes()
      .then(setAttributes)
      .catch(() => setAttributes(null));
    fetchCarFitment()
      .then(setCarTree)
      .catch(() => setCarTree([]));
  }, []);

  // Pre-fill from "Scan here → Add new product": /products/new?ref=CODE seeds the Product ID (which
  // is also the barcode source). Read once from the URL — window.location avoids useSearchParams'
  // Suspense requirement, matching how the edit page reads its ?edit flag.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setProductRef(ref);
  }, []);
  // Auto Naming. The form holds taxonomy as display names, so the Thai names are looked up from
  // the attribute lists by that name; anything missing simply falls back inside buildProductName.
  const nameInput = {
    typeNameTh:
      attributes?.types.find((t) => t.name === part.type)?.nameTh ?? part.type.trim() ?? null,
    brandName: attributes?.brands.find((b) => b.name === part.brand)?.name ?? part.brand ?? null,
    productRef,
    fitments: fitments.map((f) => ({
      carBrand: f.carBrand,
      carModel: f.carModel,
      carModelTh: attributes?.carModels.find((m) => m.name === f.carModel)?.nameTh ?? null,
    })),
  };
  const canAutoName = canBuildProductName(nameInput);

  const updatePart = (patch: Partial<PartForm>) => setPart((prev) => ({ ...prev, ...patch }));
  const updatePricing = (patch: Partial<PricingForm>) =>
    setPricing((prev) => ({ ...prev, ...patch }));

  const refWarn = useIdentifierCheck("ref", productRef);
  const shopeeWarn = useIdentifierCheck("shopee", shopeeItemId);

  /** The whole product as one atomic-save payload. `id` (once auto-save owns a row) targets that row
   *  so a mid-typing Product-ID rename updates it instead of spawning a second draft. */
  function buildProductPayload(status: "draft" | "active"): FullProductInput {
    return {
      id: autoSavedId.current ?? undefined,
      productRef,
      name,
      description,
      status,
      shopeeListed: status === "active",
      shopeeItemId: shopeeItemId || undefined,
      // The barcode is the Product ID (one identifier; scanning the part's barcode fills it in).
      barcode: productRef.trim(),
      weightGrams: Math.round((parseFloat(weightKg) || 0) * 1000),
      widthMm: cmToMm(widthCm),
      lengthMm: cmToMm(lengthCm),
      heightMm: cmToMm(heightCm),
      brandName: part.brand || undefined,
      usageName: part.usage || undefined,
      typeName: part.type || undefined,
      fitments,
      pricing: {
        itemCostSatang: toSatang(pricing.costThb),
        targetPriceSatang: toSatang(pricing.b2cThb),
        onlinePriceSatang: toSatang(pricing.onlineThb),
        b2bPriceSatang: toSatang(pricing.b2bThb),
        onlineCommissionBp: Math.round((parseFloat(pricing.onlineCommPct) || 0) * 100),
        taxOnCost: pricing.taxOnCost,
      },
    };
  }

  // Signature of the fields the draft save persists (photos + stock are applied on Publish, so they
  // are not part of it) — used to skip redundant auto-saves.
  const draftSignature = JSON.stringify({
    name,
    productRef,
    description,
    weightKg,
    widthCm,
    lengthCm,
    heightCm,
    part,
    fitments,
    pricing,
    shopeeItemId,
  });

  // Background draft auto-save: debounce, then persist as a draft once there's enough to save. The
  // atomic saveFullProduct means a failure can't strand a skeleton; the shouldAutosaveDraft guard
  // keeps the first save from landing on someone else's Product ID.
  useEffect(() => {
    if (
      !shouldAutosaveDraft({
        busy,
        name,
        productRef,
        hasAutosavedId: autoSavedId.current !== null,
        refInUse: refWarn !== null,
        signature: draftSignature,
        lastSavedSignature: lastSavedSig.current,
      })
    )
      return;
    const t = setTimeout(async () => {
      setSaveState("saving");
      try {
        const out = await saveFullProduct(buildProductPayload("draft"));
        autoSavedId.current = out.productId;
        lastSavedSig.current = draftSignature;
        setSaveState("saved");
      } catch {
        setSaveState("error"); // keep the form; Publish (or the next change) retries
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSignature, busy, refWarn]);

  /** Publish (make active) + reset for the next product. Reuses the auto-saved draft row when there
   *  is one, so publishing never creates a duplicate. */
  async function publish() {
    const missing = missingRequiredToSave({ name, productRef });
    if (missing) {
      toast(missing, "error");
      return;
    }
    setBusy(true);
    try {
      const out = await saveFullProduct(buildProductPayload("active"));
      const id = out.productId;
      // Stock is ledger-based (serialized through its Durable Object), so it runs after the atomic
      // product save. A stock hiccup can no longer lose the product data.
      const stock = Math.round(parseFloat(stockQty) || 0);
      if (out.variantId && stock > 0) {
        await adjustStock({
          productVariantId: out.variantId,
          quantityDelta: stock,
          movementType: "opening_balance",
          reason: "created from Add product",
        });
      }
      // Photos were held locally so they could be added in any order; upload them now, then release
      // the preview URLs.
      if (photos.length) {
        await uploadBufferInOrder(
          photos.map((p) => p.file),
          (file) => uploadGalleryImage(id, file),
        );
        photos.forEach((p) => URL.revokeObjectURL(p.url));
        setPhotos([]);
      }
      // Keep the batch fields (part taxonomy + fitments); reset everything per-product and start a
      // fresh draft (clear the auto-save row + signature so the next product saves cleanly).
      const cleared = clearedProductFields();
      setName(cleared.name);
      setDescription(cleared.description);
      setStockQty(cleared.stockQty);
      setWeightKg(cleared.weightKg);
      setWidthCm(cleared.widthCm);
      setLengthCm(cleared.lengthCm);
      setHeightCm(cleared.heightCm);
      setProductRef(cleared.productRef);
      setShopeeItemId(cleared.shopeeItemId);
      setPricing(cleared.pricing);
      autoSavedId.current = null;
      lastSavedSig.current = "";
      setSaveState("idle");
      setSavedCount((n) => n + 1);
      toast(`Published “${name}” — ready for the next one`, "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
      nameRef.current?.focus();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <PageHeader
        title="Add product"
        subtitle="New product — your work auto-saves as a draft. Publish when it's ready."
        action={
          <div style={{ display: "flex", gap: 12, alignItems: "center", flex: "none" }}>
            {saveState !== "idle" && (
              <span
                className="muted"
                style={{
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  color: saveState === "error" ? "var(--danger)" : undefined,
                }}
              >
                {saveState === "saving"
                  ? "Saving draft…"
                  : saveState === "saved"
                    ? "Draft saved ✓"
                    : "Couldn't save draft — will retry"}
              </span>
            )}
            {savedCount > 0 && (
              <span className="muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                +{savedCount} added
              </span>
            )}
            {/* Draft is auto-saved, so leaving keeps it — this is "close", not "discard". */}
            <button type="button" onClick={() => router.push("/products")} disabled={busy}>
              Close
            </button>
            {/* Publishing makes it active and stays on the page ready for the next product (listing
                happens in runs). */}
            <button type="button" className="btn-primary" onClick={() => publish()} disabled={busy}>
              Publish
            </button>
          </div>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Same as the Publish button — pressing Enter must not behave differently from clicking it.
          publish();
        }}
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(440px, 100%), 1fr))",
          alignItems: "start",
        }}
      >
        {savedCount > 0 && carrySummary(part, fitments.length) && (
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Carried from last product: <strong>{carrySummary(part, fitments.length)}</strong>
            </span>
            <button
              type="button"
              className="btn-soft"
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => {
                setPart({ brand: "", usage: "", type: "" });
                setFitments([]);
              }}
            >
              Clear
            </button>
          </div>
        )}

        <div style={{ ...field, gridColumn: "1 / -1" }}>
          <span style={{ fontWeight: 600 }}>Photos</span>
          <ProductGallery
            key={`next-${savedCount}`}
            productId=""
            initial={[]}
            buffer={photos}
            onBufferChange={setPhotos}
          />
        </div>

        {/* Not a <label> wrapper any more: a button inside a label steals the label's click. */}
        <div style={{ ...field, gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <label htmlFor="product-name">Product name *</label>
            <button
              type="button"
              onClick={() => setName(buildProductName(nameInput))}
              disabled={!canAutoName}
              title={
                canAutoName
                  ? "Compose the name from the part type, fitments, brand and code"
                  : "Fill in the part type, at least one fitment, and the product code first"
              }
              style={{
                background: "none",
                border: "none",
                padding: 0,
                minHeight: 0,
                fontSize: 13,
                fontWeight: 500,
                color: canAutoName ? "var(--primary)" : "var(--text-muted)",
                cursor: canAutoName ? "pointer" : "not-allowed",
              }}
            >
              Auto Naming
            </button>
          </div>
          <input
            id="product-name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={inputL}
          />
        </div>

        <label style={{ ...field, gridColumn: "1 / -1" }}>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Short spec — refrigerant, type, fitment note…"
            style={{ width: "100%", resize: "vertical" }}
          />
        </label>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", gridColumn: "1 / -1" }}>
          <label style={field}>
            Stock on hand
            <input
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              inputMode="numeric"
              style={{ ...inputS, width: 160 }}
            />
          </label>
          <label style={field}>
            Weight (kg)
            <input
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              style={{ ...inputS, width: 160 }}
            />
          </label>
          {/* Box size, not part size. Carriers rate on volumetric weight (w×l×h/5000), so a big
              light part bills by its box — without all three there is no shipping quote at all. */}
          <label style={field}>
            Box size (cm) — W × L × H
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {(
                [
                  ["W", widthCm, setWidthCm],
                  ["L", lengthCm, setLengthCm],
                  ["H", heightCm, setHeightCm],
                ] as const
              ).map(([label, value, set], i) => (
                <span key={label} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {i > 0 && <span style={{ opacity: 0.5 }}>×</span>}
                  <input
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    inputMode="decimal"
                    placeholder={label}
                    aria-label={`Box ${label} in centimetres`}
                    style={{ ...inputS, width: 72 }}
                  />
                </span>
              ))}
            </span>
          </label>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <PartDetails
            value={part}
            onChange={updatePart}
            attributes={attributes}
            productRef={productRef}
            onProductRefChange={setProductRef}
            shopeeItemId={shopeeItemId}
            onShopeeItemIdChange={setShopeeItemId}
            refWarning={refWarn}
            shopeeWarning={shopeeWarn}
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <FitmentSection fitments={fitments} onChange={setFitments} carTree={carTree} />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <PricingFields form={pricing} update={updatePricing} />
        </div>
      </form>
    </main>
  );
}

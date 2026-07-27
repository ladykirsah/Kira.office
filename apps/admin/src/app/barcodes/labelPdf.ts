import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import { chooseBarcodeFormat } from "@/lib/barcode";
import { pageDimensions, planSheet, type Orientation, type Paper } from "@/lib/labelGrid";
import { wrapLines, type LabelVersion } from "@/lib/labelForm";

export interface LabelProduct {
  /** Product ref — printed as the ID under the barcode, and encoded in it. */
  code: string;
  name: string;
  brandName: string | null;
  typeName: string | null;
  barcode: string;
  /** Pre-formatted "Brand Model Year" lines (see lib/labelForm.fitmentLines). */
  fitment: string[];
}

/** Canvas pixels per mm — high enough to print crisply. */
const RES = 12;

/**
 * The locked artwork (owner-approved 2026-07-27). Everything below is expressed in these template
 * pixels and scaled to the printed size, so the two versions keep their exact proportions.
 *
 *   Full    620 × 294 — brand · type + shop name, divider, name (2 lines), barcode + ID | fitment
 *   Minimal 632 × 212 — brand · type, then name | vertical divider | fitment
 */
const TPL = {
  full: { w: 620, h: 294 },
  minimal: { w: 632, h: 212 },
} as const;

const PAD_X = 34;
const PAD_Y = 30;
const INK = "#16181c";
const MUTED = "#8b9199";
const LINE = "#d6dae0";
const HEAD_FONT = 17;
const HEAD_LINE = HEAD_FONT * 1.6; // 27.2 — the header row's line box
const NAME_FONT = 34;
const NAME_LINE = NAME_FONT * 1.13; // 38.4
const FIT_FONT = 19;
const FIT_LINE = FIT_FONT * 1.55; // 29.45
const ID_FONT = 16;
const BARS_W = 258;
const BARS_H = 52;

const SANS = "sans-serif";
const MONO = "monospace";

/** Shop name shown on the Full label. Set from the Shop-info setting via setShopName(). */
let SHOP_NAME = "Den Air Service (Surin)";

/** Override the label header shop name (called by the studio with the saved Shop-info setting). */
export function setShopName(name: string): void {
  SHOP_NAME = (name ?? "").trim();
}

function barcodeCanvas(value: string): HTMLCanvasElement | null {
  const format = chooseBarcodeFormat(value);
  if (!format) return null;
  const c = document.createElement("canvas");
  const opts = { displayValue: false, margin: 0, width: 2, height: 80 } as const;
  try {
    JsBarcode(c, value.trim(), { format, ...opts });
  } catch {
    try {
      JsBarcode(c, value.trim(), { format: "CODE128", ...opts });
    } catch {
      return null;
    }
  }
  return c;
}

/** Break text to fit a width across up to maxLines, at word boundaries where possible. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  return wrapLines((s) => ctx.measureText(s).width, text, maxW, maxLines);
}

/** "DENSO · Radiator" — brand in heavy ink, type muted. Returns nothing; draws at the header row. */
function drawBrandType(ctx: CanvasRenderingContext2D, product: LabelProduct, midY: number): void {
  const brand = (product.brandName ?? "").trim();
  const type = (product.typeName ?? "").trim();
  let x = PAD_X;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  if (brand) {
    ctx.font = `800 ${HEAD_FONT}px ${SANS}`;
    ctx.fillStyle = INK;
    ctx.fillText(brand, x, midY);
    x += ctx.measureText(brand).width;
  }
  if (type) {
    ctx.font = `500 ${HEAD_FONT}px ${SANS}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(brand ? ` · ${type}` : type, x, midY);
  }
}

/** Width of the widest fitment line, at the fitment font. */
function fitmentWidth(ctx: CanvasRenderingContext2D, lines: string[]): number {
  ctx.font = `${FIT_FONT}px ${SANS}`;
  return lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
}

/** Draw the fitment block, either pinned to `bottom` (Full) or growing from `top` (Minimal). */
function drawFitment(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  opts: { align: "left" | "right"; x: number; top?: number; bottom?: number },
): void {
  ctx.font = `${FIT_FONT}px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = opts.align;
  if (opts.bottom != null) {
    ctx.textBaseline = "bottom";
    lines.forEach((l, i) => {
      ctx.fillText(l, opts.x, (opts.bottom as number) - (lines.length - 1 - i) * FIT_LINE);
    });
  } else {
    ctx.textBaseline = "top";
    lines.forEach((l, i) => {
      ctx.fillText(l, opts.x, (opts.top ?? 0) + i * FIT_LINE);
    });
  }
}

/**
 * Draw one product label onto a canvas sized to (wMm × hMm), in the locked layout for its version.
 * The canvas is scaled from the version's artwork template, so proportions never drift.
 */
export function drawLabel(
  canvas: HTMLCanvasElement,
  product: LabelProduct,
  version: LabelVersion,
  wMm: number,
  hMm: number,
): void {
  const W = Math.round(wMm * RES);
  const H = Math.round(hMm * RES);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const tpl = TPL[version];
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  // Everything below is drawn in template pixels; one scale keeps the locked proportions.
  ctx.save();
  ctx.scale(W / tpl.w, H / tpl.h);

  const right = tpl.w - PAD_X;
  const headMid = PAD_Y + HEAD_LINE / 2;
  drawBrandType(ctx, product, headMid);

  if (version === "full") {
    if (SHOP_NAME) {
      ctx.font = `700 ${HEAD_FONT}px ${SANS}`;
      ctx.fillStyle = INK;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(SHOP_NAME, right, headMid);
    }

    // Divider under the header
    const dividerY = PAD_Y + HEAD_LINE + 9;
    ctx.fillStyle = LINE;
    ctx.fillRect(PAD_X, dividerY, tpl.w - 2 * PAD_X, 2);

    // Product name — the hero, up to 2 lines
    ctx.font = `800 ${NAME_FONT}px ${SANS}`;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const nameTop = dividerY + 2 + 15;
    wrap(ctx, product.name, tpl.w - 2 * PAD_X, 2).forEach((ln, i) => {
      ctx.fillText(ln, PAD_X, nameTop + i * NAME_LINE + (NAME_LINE - NAME_FONT) / 2);
    });

    // Bottom row: barcode + ID (left) · fitment (right), both pinned to the bottom padding
    const bottom = tpl.h - PAD_Y;
    ctx.font = `${ID_FONT}px ${MONO}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.font = `700 ${ID_FONT}px ${MONO}`;
    ctx.fillText("ID", PAD_X, bottom);
    const idLabelW = ctx.measureText("ID ").width;
    ctx.font = `${ID_FONT}px ${MONO}`;
    ctx.fillStyle = INK;
    ctx.fillText(product.code, PAD_X + idLabelW, bottom);

    const barsBottom = bottom - ID_FONT * 1.25 - 7;
    const bc = product.barcode ? barcodeCanvas(product.barcode) : null;
    if (bc) ctx.drawImage(bc, PAD_X, barsBottom - BARS_H, BARS_W, BARS_H);

    if (product.fitment.length) {
      drawFitment(ctx, product.fitment, { align: "right", x: right, bottom });
    }
  } else {
    // Minimal: name | vertical divider | fitment, no shop name and no header divider
    const bodyTop = PAD_Y + HEAD_LINE + 14;
    const bodyBottom = tpl.h - PAD_Y;
    let nameW = tpl.w - 2 * PAD_X;
    if (product.fitment.length) {
      // The fitment column takes its natural width; the name gets what's left.
      const fitX = right - fitmentWidth(ctx, product.fitment);
      drawFitment(ctx, product.fitment, { align: "left", x: fitX, top: bodyTop });
      const dividerX = fitX - 26;
      ctx.fillStyle = LINE;
      ctx.fillRect(dividerX, bodyTop, 2, bodyBottom - bodyTop);
      nameW = dividerX - 26 - PAD_X;
    }

    ctx.font = `800 ${NAME_FONT}px ${SANS}`;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    wrap(ctx, product.name, nameW, 3).forEach((ln, i) => {
      ctx.fillText(ln, PAD_X, bodyTop + i * NAME_LINE + (NAME_LINE - NAME_FONT) / 2);
    });
  }

  ctx.restore();
}

export interface SheetLabel extends LabelProduct {
  version: LabelVersion;
  w: number;
  h: number;
  amount: number;
}

/** Labels tile edge to edge — the sheet is cut with a guillotine, so no gap between them. */
const SHEET_MARGIN = 8;
const SHEET_GAP = 0;

/** Build and download one PDF holding several products' labels, each at its own size and count. */
export function downloadLabelSheet(opts: {
  paper: Paper;
  orientation: Orientation;
  items: SheetLabel[];
}): void {
  const { paper, orientation, items } = opts;
  const page = pageDimensions(paper, orientation);
  const plan = planSheet({
    items: items.map((i) => ({ w: i.w, h: i.h, amount: i.amount })),
    page,
    margin: SHEET_MARGIN,
    gap: SHEET_GAP,
  });
  if (!plan.placements.length) return;

  // Render each product's label image once, then stamp it at every placement.
  const images = items.map((it) => {
    const c = document.createElement("canvas");
    drawLabel(c, it, it.version, it.w, it.h);
    return c.toDataURL("image/png");
  });

  const doc = new jsPDF({ unit: "mm", format: paper.toLowerCase(), orientation });
  let cur = 0;
  for (const pl of plan.placements) {
    while (pl.page > cur) {
      doc.addPage();
      cur++;
    }
    const it = items[pl.index];
    doc.addImage(images[pl.index], "PNG", pl.x, pl.y, it.w, it.h);
  }
  const tag = items.length === 1 ? items[0].code || "labels" : `${items.length}-products`;
  doc.save(`labels-${tag}.pdf`);
}

const PREVIEW_PX_PER_MM = 3;

/** Render a live, to-scale preview of the printed page(s) into `container` (one canvas per page). */
export function renderSheetPreview(
  container: HTMLElement,
  opts: { paper: Paper; orientation: Orientation; items: SheetLabel[] },
): void {
  container.replaceChildren();
  const { paper, orientation, items } = opts;
  const page = pageDimensions(paper, orientation);
  const plan = planSheet({
    items: items.map((i) => ({ w: i.w, h: i.h, amount: i.amount })),
    page,
    margin: SHEET_MARGIN,
    gap: SHEET_GAP,
  });
  if (!plan.placements.length) return;

  const labelImages = items.map((it) => {
    const c = document.createElement("canvas");
    drawLabel(c, it, it.version, it.w, it.h);
    return c;
  });

  const pv = PREVIEW_PX_PER_MM;
  for (let pg = 0; pg < plan.pages; pg++) {
    const canvas = document.createElement("canvas");
    canvas.className = "sheet-page";
    canvas.width = Math.round(page.width * pv);
    canvas.height = Math.round(page.height * pv);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const pl of plan.placements) {
        if (pl.page !== pg) continue;
        const it = items[pl.index];
        ctx.drawImage(labelImages[pl.index], pl.x * pv, pl.y * pv, it.w * pv, it.h * pv);
      }
    }
    container.appendChild(canvas);
  }
}

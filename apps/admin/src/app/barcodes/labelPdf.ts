import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import { chooseBarcodeFormat } from "@/lib/barcode";
import { pageDimensions, planSheet, type Orientation, type Paper } from "@/lib/labelGrid";

export interface LabelProduct {
  code: string;
  name: string;
  tags: string[];
  barcode: string;
}

/** Canvas pixels per mm — high enough to print crisply. */
const RES = 12;

/** Shop name shown as the label header. Set from the Shop-info setting via setShopName(). */
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

/** Break text to fit a width across up to maxLines, character by character (works for Thai too). */
function wrapChars(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of [...text]) {
    if (line && ctx.measureText(line + ch).width > maxW) {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines) break;
    } else {
      line += ch;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const last = lines[maxLines - 1];
  if (lines.length === maxLines && last && ctx.measureText(last).width > maxW) {
    let t = last;
    while (t.length && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
    lines[maxLines - 1] = `${t}…`;
  }
  return lines;
}

/** Draw one product label onto a canvas sized to (wMm × hMm). Tags · name · barcode · code. */
export function drawLabel(
  canvas: HTMLCanvasElement,
  product: LabelProduct,
  wMm: number,
  hMm: number,
  showBarcode = true,
): void {
  const W = Math.round(wMm * RES);
  const H = Math.round(hMm * RES);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const pad = 2 * RES;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#c8ccd2"; // gray frame line (text + barcode stay black)
  ctx.lineWidth = Math.max(1, 0.2 * RES);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  let y = pad;

  // Shop name header + divider line (only when a shop name is set)
  if (SHOP_NAME) {
    ctx.fillStyle = "#000000";
    ctx.font = `500 ${2.3 * RES}px sans-serif`;
    ctx.fillText(wrapChars(ctx, SHOP_NAME, W - 2 * pad, 1)[0] ?? "", pad, y);
    y += 2.9 * RES;
    ctx.strokeStyle = "#c8ccd2";
    ctx.lineWidth = Math.max(1, 0.12 * RES);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(W - pad, y);
    ctx.stroke();
    y += 1.4 * RES;
  }

  // Tags
  const tags = product.tags.filter(Boolean).join("   ·   ");
  if (tags) {
    ctx.fillStyle = "#000000";
    ctx.font = `${2.5 * RES}px sans-serif`;
    ctx.fillText(wrapChars(ctx, tags, W - 2 * pad, 1)[0] ?? "", pad, y);
    y += 3.3 * RES;
  }

  // Name (bold, larger, up to 2 lines)
  ctx.fillStyle = "#000000";
  ctx.font = `600 ${3.4 * RES}px sans-serif`;
  for (const ln of wrapChars(ctx, product.name, W - 2 * pad, 2)) {
    ctx.fillText(ln, pad, y);
    y += 3.9 * RES;
  }

  if (!showBarcode) return;

  // Code (bottom, centered)
  ctx.fillStyle = "#000000";
  ctx.font = `${2.4 * RES}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(product.code, W / 2, H - pad - 2.4 * RES);

  // Barcode (fills the space between the name and the code)
  const bc = barcodeCanvas(product.barcode);
  if (bc) {
    const bx = pad;
    const bw = W - 2 * pad;
    const top = y + 0.5 * RES;
    const bottom = H - pad - 3 * RES;
    const bh = Math.max(RES, Math.min(bottom - top, bw * (bc.height / bc.width)));
    if (bh > 0) ctx.drawImage(bc, bx, Math.max(top, bottom - bh), bw, bh);
  }
}

/** Height (mm) needed for just the tags + name at a given width (used when the barcode is hidden). */
export function contentHeightMm(product: LabelProduct, wMm: number): number {
  const W = Math.max(1, Math.round(wMm * RES));
  const pad = 2 * RES;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = 10;
  const ctx = c.getContext("2d");
  if (!ctx) return wMm;
  let h = pad;
  if (SHOP_NAME) {
    h += 2.9 * RES; // shop name
    h += 1.4 * RES; // divider gap
  }
  const tags = product.tags.filter(Boolean).join("   ·   ");
  if (tags) h += 3.3 * RES;
  ctx.font = `600 ${3.4 * RES}px sans-serif`;
  const lines = wrapChars(ctx, product.name, W - 2 * pad, 2);
  h += Math.max(1, lines.length) * 3.9 * RES;
  h += 1.2 * RES; // bottom margin
  return h / RES;
}

/** The label's effective height: the set height when showing the barcode, else the content-fit height. */
export function effectiveHeightMm(
  product: LabelProduct,
  wMm: number,
  hMm: number,
  showBarcode: boolean,
): number {
  return showBarcode ? hMm : contentHeightMm(product, wMm);
}

export interface SheetLabel extends LabelProduct {
  w: number;
  h: number;
  amount: number;
  showBarcode: boolean;
}

/** Build and download one PDF holding several products' labels, each at its own size and count. */
export function downloadLabelSheet(opts: {
  paper: Paper;
  orientation: Orientation;
  items: SheetLabel[];
}): void {
  const { paper, orientation, items } = opts;
  const page = pageDimensions(paper, orientation);
  const margin = 8;
  const gap = 4;
  const plan = planSheet({
    items: items.map((i) => ({ w: i.w, h: i.h, amount: i.amount })),
    page,
    margin,
    gap,
  });
  if (!plan.placements.length) return;

  // Render each product's label image once, then stamp it at every placement.
  const images = items.map((it) => {
    const c = document.createElement("canvas");
    drawLabel(c, it, it.w, it.h, it.showBarcode);
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
  const margin = 8;
  const gap = 4;
  const plan = planSheet({
    items: items.map((i) => ({ w: i.w, h: i.h, amount: i.amount })),
    page,
    margin,
    gap,
  });
  if (!plan.placements.length) return;

  const labelImages = items.map((it) => {
    const c = document.createElement("canvas");
    drawLabel(c, it, it.w, it.h, it.showBarcode);
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

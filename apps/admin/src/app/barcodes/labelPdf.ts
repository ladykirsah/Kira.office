import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import { chooseBarcodeFormat } from "@/lib/barcode";
import { pageDimensions, planLabelGrid, type Orientation, type Paper } from "@/lib/labelGrid";

export interface LabelProduct {
  code: string;
  name: string;
  tags: string[];
  barcode: string;
}

/** Canvas pixels per mm — high enough to print crisply. */
const RES = 12;

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
  ctx.strokeStyle = "#c8ccd2";
  ctx.lineWidth = Math.max(1, 0.2 * RES);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  let y = pad;

  // Tags (small, muted)
  const tags = product.tags.filter(Boolean).join("   ·   ");
  if (tags) {
    ctx.fillStyle = "#8b95a3";
    ctx.font = `${2.1 * RES}px sans-serif`;
    ctx.fillText(wrapChars(ctx, tags, W - 2 * pad, 1)[0] ?? "", pad, y);
    y += 2.9 * RES;
  }

  // Name (bold, up to 2 lines)
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `600 ${2.9 * RES}px sans-serif`;
  for (const ln of wrapChars(ctx, product.name, W - 2 * pad, 2)) {
    ctx.fillText(ln, pad, y);
    y += 3.4 * RES;
  }

  // Code (bottom, centered)
  ctx.fillStyle = "#444";
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

/** Build and download a PDF that tiles the product's label `amount` times across A4/A5 pages. */
export function downloadLabelPdf(opts: {
  paper: Paper;
  orientation: Orientation;
  labelW: number;
  labelH: number;
  amount: number;
  product: LabelProduct;
}): void {
  const { paper, orientation, labelW, labelH, amount, product } = opts;
  const page = pageDimensions(paper, orientation);
  const margin = 8;
  const gap = 4;
  const { cols, perPage } = planLabelGrid({ page, labelW, labelH, margin, gap });
  if (perPage < 1) return;

  const canvas = document.createElement("canvas");
  drawLabel(canvas, product, labelW, labelH);
  const img = canvas.toDataURL("image/png");

  const doc = new jsPDF({ unit: "mm", format: paper.toLowerCase(), orientation });
  for (let i = 0; i < amount; i++) {
    const onPage = i % perPage;
    if (i > 0 && onPage === 0) doc.addPage();
    const c = onPage % cols;
    const r = Math.floor(onPage / cols);
    const x = margin + c * (labelW + gap);
    const yy = margin + r * (labelH + gap);
    doc.addImage(img, "PNG", x, yy, labelW, labelH);
  }
  doc.save(`${product.code || "labels"}-${labelW}x${labelH}mm-x${amount}.pdf`);
}

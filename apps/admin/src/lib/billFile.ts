import { jsPDF } from "jspdf";
import { captureNode, saveCanvasPng, safeFileStem } from "./htmlCapture";
import { billPageLayout } from "./billPage";

/**
 * Saving the bill as a real file — a download, not the browser's print dialog.
 *
 * The bill is Thai, and jsPDF can only draw Thai with a large embedded font, so both formats go
 * through the same route the barcode labels take: render the bill to a canvas (the browser draws
 * Thai correctly), then either save that image or place it in a PDF page. One capture, two files,
 * and the output always matches the bill on screen because it IS the bill on screen.
 *
 * The capture itself lives in htmlCapture, shared with the parcel label — its options are
 * load-bearing and a second copy would drift.
 */

/** File name for a saved bill: the bill number when it has one, else the plate. */
export function billFileName(
  kind: "pdf" | "png",
  opts: { saleNumber?: string; plate?: string },
): string {
  const raw = (opts.saleNumber ?? "").trim() || (opts.plate ?? "").trim();
  return ["bill", safeFileStem(raw)].filter(Boolean).join("-") + `.${kind}`;
}

/** Save the bill as a PNG image — the one-tap file to send on LINE. */
export async function saveBillPng(node: HTMLElement, fileName: string): Promise<void> {
  await saveCanvasPng(await captureNode(node), fileName);
}

/** Save the bill as a PDF on real paper: A5 portrait, or A4 when the list is too long (see billPage). */
export async function saveBillPdf(node: HTMLElement, fileName: string): Promise<void> {
  const canvas = await captureNode(node);
  const layout = billPageLayout(canvas);
  const doc = new jsPDF({
    unit: "mm",
    format: [layout.page.w, layout.page.h],
    orientation: "portrait",
  });
  doc.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    layout.x,
    layout.y,
    layout.w,
    layout.h,
    undefined,
    "FAST",
  );
  doc.save(fileName);
}

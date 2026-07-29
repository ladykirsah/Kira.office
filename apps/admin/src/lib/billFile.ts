import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { billPageLayout } from "./billPage";

/**
 * Saving the bill as a real file — a download, not the browser's print dialog.
 *
 * The bill is Thai, and jsPDF can only draw Thai with a large embedded font, so both formats go
 * through the same route the barcode labels take: render the bill to a canvas (the browser draws
 * Thai correctly), then either save that image or place it in a PDF page. One capture, two files,
 * and the output always matches the bill on screen because it IS the bill on screen.
 */

/** File name for a saved bill: the bill number when it has one, else the plate. */
export function billFileName(
  kind: "pdf" | "png",
  opts: { saleNumber?: string; plate?: string },
): string {
  const raw = (opts.saleNumber ?? "").trim() || (opts.plate ?? "").trim();
  const safe = raw
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return ["bill", safe].filter(Boolean).join("-") + `.${kind}`;
}

/**
 * Capture the bill element. 4× so the result survives zooming — at A5 width that is roughly 380 dpi,
 * where the Thai glyphs and hairlines stay clean instead of breaking up.
 */
const CAPTURE_SCALE = 4;

async function captureBill(node: HTMLElement): Promise<HTMLCanvasElement> {
  // Capture the element's FULL content, not just the part on screen. html2canvas otherwise shoots
  // the visible box, so anything the layout clipped (a long list, the totals row) was missing from
  // the saved file — the customer got a bill with no total on it.
  return html2canvas(node, {
    scale: CAPTURE_SCALE,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    width: node.scrollWidth,
    height: node.scrollHeight,
    windowHeight: Math.max(node.scrollHeight, document.documentElement.clientHeight),
  });
}

function download(href: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  a.click();
}

/** Save the bill as a PNG image — the one-tap file to send on LINE. */
export async function saveBillPng(node: HTMLElement, fileName: string): Promise<void> {
  const canvas = await captureBill(node);
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        download(url, fileName);
        // Give the browser a tick to start the download before dropping the object URL.
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
      resolve();
    }, "image/png");
  });
}

/** Save the bill as a PDF on real paper: A5 portrait, or A4 when the list is too long (see billPage). */
export async function saveBillPdf(node: HTMLElement, fileName: string): Promise<void> {
  const canvas = await captureBill(node);
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

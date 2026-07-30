import { jsPDF } from "jspdf";
import { captureNode, download, saveCanvasPng, safeFileStem } from "./htmlCapture";
import { labelPageLayout } from "./labelPage";

/**
 * Saving a parcel label as a real file, so it can be printed at the counter or sent on.
 *
 * Same route as a saved bill (see htmlCapture): the browser renders the label — Thai receiver
 * addresses and Thai product names included — and the raster goes into a PNG or a PDF page. Drawing
 * the text into the PDF directly would need a Thai font embedded in the bundle.
 */

/** `label-AP-1042.pdf` — the order reference, because that is what the operator is looking for. */
export function shippingLabelFileName(kind: "pdf" | "png", orderRef: string): string {
  return ["label", safeFileStem(orderRef)].filter(Boolean).join("-") + `.${kind}`;
}

export async function saveLabelPng(node: HTMLElement, fileName: string): Promise<void> {
  await saveCanvasPng(await captureNode(node), fileName);
}

export async function saveLabelPdf(node: HTMLElement, fileName: string): Promise<void> {
  const canvas = await captureNode(node);
  const layout = labelPageLayout(canvas);
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
  // Not doc.save(): jsPDF's own save() is a download too, but going through the shared helper keeps
  // one code path for "a file left the browser".
  download(doc.output("bloburl").toString(), fileName);
}

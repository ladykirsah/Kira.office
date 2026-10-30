import { labelPageLayout } from "@/lib/shippingLabel";

/** 4× so Thai text and thin lines stay clean when printed — about 380 dpi on a 100 mm label. */
const CAPTURE_SCALE = 4;

function download(href: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  a.click();
}

/**
 * Saves the label on screen as a file (owner, 29 Oct: PDF and PNG are saving). The browser draws the
 * Thai text, and that picture goes into a PNG or onto a 100 × 150 mm PDF page — the web back office's
 * way, with its same two tools, loaded only when a file is asked for.
 */
export async function saveLabel(
  kind: "pdf" | "png",
  node: unknown,
  fileName: string,
): Promise<void> {
  const el = node as HTMLElement;
  const { default: html2canvas } = await import("html2canvas");
  // The whole label, not only the part in view, so a long item list is never cut off.
  const canvas = await html2canvas(el, {
    scale: CAPTURE_SCALE,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    width: el.scrollWidth,
    height: el.scrollHeight,
    windowHeight: Math.max(el.scrollHeight, document.documentElement.clientHeight),
  });

  if (kind === "png") {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The picture could not be made");
    const url = URL.createObjectURL(blob);
    download(url, fileName);
    // Give the browser a moment to start the download before letting go of the picture.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }

  const { jsPDF } = await import("jspdf");
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
  download(doc.output("bloburl").toString(), fileName);
}

import html2canvas from "html2canvas";

/**
 * Rasterise a DOM node, for the files the admin saves — bills and shipping labels.
 *
 * Both are Thai, and jsPDF can only draw Thai with a large embedded font, so neither draws text into
 * a PDF directly. Instead the browser renders the markup (it lays out Thai correctly) and the result
 * is either saved as an image or placed into a PDF page. One capture, two formats, and the output
 * always matches what is on screen because it IS what is on screen.
 *
 * Shared rather than copy-pasted: the options below are load-bearing, and getting them wrong has
 * already shipped a broken file once.
 */

/** 4× so the result survives zooming — at A5 width that is roughly 380 dpi, where Thai glyphs and
 * hairlines stay clean instead of breaking up. */
const CAPTURE_SCALE = 4;

export async function captureNode(node: HTMLElement): Promise<HTMLCanvasElement> {
  // Capture the element's FULL content, not just the part on screen. html2canvas otherwise shoots the
  // visible box, so anything the layout clipped (a long list, the totals row) was missing from the
  // saved file — the customer got a bill with no total on it.
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

/** Trigger a browser download for a blob or data URL. */
export function download(href: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  a.click();
}

/** Save a captured canvas as a PNG file. */
export async function saveCanvasPng(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
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

/**
 * Strip the characters a file system will not take out of a name the operator recognises (a bill
 * number, an order reference), leaving something still readable in a downloads folder.
 */
export function safeFileStem(raw: string): string {
  return raw
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

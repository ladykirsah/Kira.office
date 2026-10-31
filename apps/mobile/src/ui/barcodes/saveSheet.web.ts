import { pageSize, type Paper, type PaperWay } from "@/lib/labelSheet";

/** The page is drawn at 4 px per mm; ×4 gives 16 px per mm, about 400 dpi when printed. */
const CAPTURE_SCALE = 4;

function download(href: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  a.click();
}

async function picture(node: unknown): Promise<HTMLCanvasElement> {
  const el = node as HTMLElement;
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas(el, {
    scale: CAPTURE_SCALE,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    width: el.scrollWidth,
    height: el.scrollHeight,
  });
}

async function downloadPng(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The picture could not be made");
  const url = URL.createObjectURL(blob);
  download(url, fileName);
  // Give the browser a moment to start the download before letting go of the picture.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * The sheet as files (the web back office's way, with its same two tools, loaded only when a file is
 * asked for): the browser draws each page — Thai text and all — and that picture becomes one PDF
 * page at the paper's exact size, or one PNG per page.
 */
export async function savePages(
  kind: "pdf" | "png",
  pages: unknown[],
  paper: Paper,
  way: PaperWay,
  baseName: string,
): Promise<void> {
  const canvases: HTMLCanvasElement[] = [];
  for (const page of pages) canvases.push(await picture(page));
  if (kind === "png") {
    for (const [i, canvas] of canvases.entries()) {
      await downloadPng(canvas, pages.length > 1 ? `${baseName}-${i + 1}.png` : `${baseName}.png`);
    }
    return;
  }
  const { jsPDF } = await import("jspdf");
  const { width, height } = pageSize(paper, way);
  const doc = new jsPDF({ unit: "mm", format: paper.toLowerCase(), orientation: way });
  canvases.forEach((canvas, i) => {
    if (i > 0) doc.addPage(paper.toLowerCase(), way);
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, width, height, undefined, "FAST");
  });
  download(doc.output("bloburl").toString(), `${baseName}.pdf`);
}

/** One label as a picture (บันทึกป้ายนี้เป็นรูป). */
export async function saveOneLabel(node: unknown, fileName: string): Promise<void> {
  await downloadPng(await picture(node), fileName);
}

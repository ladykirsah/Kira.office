/** 3× so Thai text stays sharp on a phone screen and on paper. */
const CAPTURE_SCALE = 3;
/** The bill's paper width: A6, a pocket-size receipt. Its height follows the bill. */
const PAGE_WIDTH_MM = 105;

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

async function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The picture could not be made");
  return blob;
}

/**
 * The bill on screen as a file — the Orders label's way (owner, 29 Oct: PDF and PNG are saving): the
 * browser draws the Thai text, and that picture becomes a PNG or one PDF page as long as the bill.
 */
export async function saveDoc(kind: "pdf" | "png", node: unknown, fileName: string): Promise<void> {
  const canvas = await picture(node);
  if (kind === "png") {
    const url = URL.createObjectURL(await pngBlob(canvas));
    download(url, fileName);
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }
  const { jsPDF } = await import("jspdf");
  const height = (PAGE_WIDTH_MM * canvas.height) / canvas.width;
  const doc = new jsPDF({ unit: "mm", format: [PAGE_WIDTH_MM, height], orientation: "portrait" });
  doc.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    0,
    0,
    PAGE_WIDTH_MM,
    height,
    undefined,
    "FAST",
  );
  download(doc.output("bloburl").toString(), fileName);
}

/**
 * ส่งบิลให้ลูกค้า: the phone's own share sheet with the bill's picture (LINE, Messages…). A browser
 * that cannot share files saves the picture instead, so there is always a file to send.
 */
export async function shareDoc(node: unknown, fileName: string): Promise<"shared" | "saved"> {
  const blob = await pngBlob(await picture(node));
  const file = new File([blob], fileName, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "shared";
      throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  download(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return "saved";
}

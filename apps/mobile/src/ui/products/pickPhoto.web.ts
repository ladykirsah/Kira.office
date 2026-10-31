/**
 * A product photo from the phone (canvas v194): "camera" opens the phone's own camera to take a
 * normal picture, "library" its photo album. On the web this is the browser's file chooser, which a
 * phone shows as exactly that; it must be opened during the tap itself.
 */
export function pickPhoto(source: "camera" | "library"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    if (source === "camera") input.setAttribute("capture", "environment");
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // A cancelled chooser fires no change; the window regaining focus ends the wait instead.
    window.addEventListener("focus", () => setTimeout(() => resolve(null), 800), { once: true });
    input.click();
  });
}

/** A local picture of the chosen file, to show before it is saved. */
export function photoPreview(photo: Blob): string {
  return URL.createObjectURL(photo);
}

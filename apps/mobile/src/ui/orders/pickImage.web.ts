/**
 * Our transfer slip, chosen from the phone's photos or files. On the web this is the browser's own
 * file chooser; it must be opened during the tap itself.
 */
export function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // A cancelled chooser fires no change; the window regaining focus ends the wait instead.
    window.addEventListener("focus", () => setTimeout(() => resolve(null), 800), { once: true });
    input.click();
  });
}

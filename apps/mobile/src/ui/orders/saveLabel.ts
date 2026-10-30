/**
 * Saving the label as a file in the phone app needs modules the app does not carry yet (web first,
 * owner 2026-10-26). Until then the button says so instead of doing nothing.
 */
export async function saveLabel(
  _kind: "pdf" | "png",
  _node: unknown,
  _fileName: string,
): Promise<void> {
  throw new Error("Saving the label works in the web version for now");
}

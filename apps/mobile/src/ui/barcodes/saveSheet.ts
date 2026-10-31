import type { Paper, PaperWay } from "@/lib/labelSheet";

/**
 * Saving labels as files in the phone app needs modules the app does not carry yet (web first,
 * owner 2026-10-26). Until then the button says so instead of doing nothing.
 */
export async function savePages(
  _kind: "pdf" | "png",
  _pages: unknown[],
  _paper: Paper,
  _way: PaperWay,
  _baseName: string,
): Promise<void> {
  throw new Error("Saving labels works in the web version for now");
}

export async function saveOneLabel(_node: unknown, _fileName: string): Promise<void> {
  throw new Error("Saving labels works in the web version for now");
}

/**
 * Share-a-product helpers.
 *
 * The PDP header's Share action wants to "send this product to someone". On phones the right tool is
 * the OS share sheet (Web Share API → LINE, Messages, …); on desktops, where Web Share is usually
 * absent, we fall back to copying the URL. The orchestration is a pure function over injected
 * capabilities so it unit-tests in Node with no DOM — the component passes the real `navigator`.
 */

export type ShareOutcome = "shared" | "copied" | "cancelled" | "unsupported";

/** Outcome of trying to hand a generated image to the OS: shared, user-cancelled, or "download" =
 *  Web Share can't take the file, so the caller should fall back to a plain file download. */
export type ImageSaveOutcome = "shared" | "cancelled" | "download";

/** The subset of `navigator` the image-save path touches (Web Share with files, both optional). */
export interface FileShareCapableNavigator {
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  canShare?: (data: { files?: File[] }) => boolean;
}

/**
 * Try to hand a generated image file to the OS share sheet — on a phone that surfaces "Save Image"
 * (→ Photos) and "send to a banking app", which is exactly the pay-from-one-phone flow. Reports:
 * - "shared"    — the sheet opened and completed.
 * - "cancelled" — the user dismissed the sheet (AbortError); NOT a failure, don't also download.
 * - "download"  — Web Share can't take files here (most desktops, older browsers), or the share
 *                 threw for a non-abort reason; the caller should fall back to a normal download.
 * Pure over an injected `navigator` so it unit-tests in Node with no DOM, like shareOrCopy.
 */
export async function shareImageOrDownload(
  nav: FileShareCapableNavigator,
  file: File,
  title: string,
): Promise<ImageSaveOutcome> {
  if (
    typeof nav.share === "function" &&
    typeof nav.canShare === "function" &&
    nav.canShare({ files: [file] })
  ) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (err) {
      if ((err as { name?: string } | null)?.name === "AbortError") return "cancelled";
      // any other share failure → fall through to a plain download
    }
  }
  return "download";
}

/** The subset of `navigator` this module touches (Web Share + async clipboard, both optional). */
export interface ShareCapableNavigator {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: { writeText?: (text: string) => Promise<void> };
}

/** Strip the "… — AirPlus" suffix that `generateMetadata` appends, for a clean share title. */
export function productShareTitle(documentTitle: string): string {
  return documentTitle.replace(/\s*—\s*AirPlus\s*$/u, "").trim() || "AirPlus";
}

/**
 * Share a product URL via the native share sheet when available, else copy it to the clipboard.
 * - Web Share present → open the sheet; a user-dismissed sheet ("AbortError") is not a failure and
 *   must NOT silently copy behind their back. Any other share error falls through to copying.
 * - No Web Share → copy the URL. Neither capability → "unsupported" (caller decides how to surface).
 * The AbortError check matches on `.name` alone: a real AbortError is a DOMException, which is not
 * `instanceof Error` in browsers.
 */
export async function shareOrCopy(
  nav: ShareCapableNavigator,
  payload: { title: string; url: string },
): Promise<ShareOutcome> {
  if (typeof nav.share === "function") {
    try {
      await nav.share({ title: payload.title, url: payload.url });
      return "shared";
    } catch (err) {
      if ((err as { name?: string } | null)?.name === "AbortError") return "cancelled";
      // fall through to the copy fallback for any other share failure
    }
  }
  if (typeof nav.clipboard?.writeText === "function") {
    try {
      await nav.clipboard.writeText(payload.url);
      return "copied";
    } catch {
      // clipboard blocked (permissions / not focused / insecure context) — treat as unsupported
    }
  }
  return "unsupported";
}

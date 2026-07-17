import { describe, it, expect, vi } from "vitest";
import {
  productShareTitle,
  shareOrCopy,
  shareImageOrDownload,
  type ShareCapableNavigator,
  type FileShareCapableNavigator,
} from "./share";

describe("productShareTitle", () => {
  it("given a metadata title with the ' — AirPlus' suffix > strips the suffix", () => {
    expect(productShareTitle("คอมเพรสเซอร์แอร์ Toyota Vigo 10S11C — AirPlus")).toBe(
      "คอมเพรสเซอร์แอร์ Toyota Vigo 10S11C",
    );
  });

  it("given a title without the suffix > returns it unchanged", () => {
    expect(productShareTitle("AirPlus")).toBe("AirPlus");
  });

  it("given an empty title > falls back to 'AirPlus'", () => {
    expect(productShareTitle("")).toBe("AirPlus");
  });
});

describe("shareOrCopy", () => {
  const payload = { title: "คอมเพรสเซอร์แอร์", url: "https://airplus.example/products/abc" };

  it("given Web Share is available > shares the title+url and reports 'shared' (no copy)", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav: ShareCapableNavigator = { share, clipboard: { writeText } };

    await expect(shareOrCopy(nav, payload)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: payload.title, url: payload.url });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("given no Web Share but a clipboard > copies the url and reports 'copied'", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav: ShareCapableNavigator = { clipboard: { writeText } };

    await expect(shareOrCopy(nav, payload)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(payload.url);
  });

  it("given the user dismisses the share sheet (AbortError) > reports 'cancelled' and does NOT fall back to copy", async () => {
    // DOMException, not Error — a real AbortError is NOT `instanceof Error` in browsers, so the
    // module must match on `.name` alone. This test guards that trap.
    const share = vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav: ShareCapableNavigator = { share, clipboard: { writeText } };

    await expect(shareOrCopy(nav, payload)).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("given share fails for a non-abort reason > falls back to copying the url", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("not allowed", "NotAllowedError"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav: ShareCapableNavigator = { share, clipboard: { writeText } };

    await expect(shareOrCopy(nav, payload)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(payload.url);
  });

  it("given neither Web Share nor clipboard is available > reports 'unsupported'", async () => {
    await expect(shareOrCopy({}, payload)).resolves.toBe("unsupported");
  });

  it("given the clipboard exists but writeText rejects > reports 'unsupported' (never throws in a click handler)", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    const nav: ShareCapableNavigator = { clipboard: { writeText } };

    await expect(shareOrCopy(nav, payload)).resolves.toBe("unsupported");
  });
});

describe("shareImageOrDownload", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "airplus-qr.png", { type: "image/png" });

  it("given Web Share can take the file > shares it and reports 'shared'", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    const nav: FileShareCapableNavigator = { share, canShare };

    await expect(shareImageOrDownload(nav, file, "PromptPay QR")).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file], title: "PromptPay QR" });
  });

  it("given canShare rejects files > reports 'download' without calling share", async () => {
    const share = vi.fn();
    const canShare = vi.fn().mockReturnValue(false);
    const nav: FileShareCapableNavigator = { share, canShare };

    await expect(shareImageOrDownload(nav, file, "PromptPay QR")).resolves.toBe("download");
    expect(share).not.toHaveBeenCalled();
  });

  it("given the user dismisses the sheet > reports 'cancelled' (never a silent download)", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("dismissed", "AbortError"));
    const canShare = vi.fn().mockReturnValue(true);

    await expect(shareImageOrDownload({ share, canShare }, file, "PromptPay QR")).resolves.toBe(
      "cancelled",
    );
  });

  it("given share throws a non-abort error > falls back to 'download'", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("nope", "NotAllowedError"));
    const canShare = vi.fn().mockReturnValue(true);

    await expect(shareImageOrDownload({ share, canShare }, file, "PromptPay QR")).resolves.toBe(
      "download",
    );
  });

  it("given no Web Share at all > reports 'download'", async () => {
    await expect(shareImageOrDownload({}, file, "PromptPay QR")).resolves.toBe("download");
  });
});

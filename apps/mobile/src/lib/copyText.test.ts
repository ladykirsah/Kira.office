import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./copyText";

const withClipboard = (clipboard: unknown) =>
  vi.stubGlobal("navigator", clipboard === undefined ? {} : { clipboard });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyText", () => {
  it("given the browser copies it > then true", async () => {
    const writeText = vi.fn(async () => undefined);
    withClipboard({ writeText });
    expect(await copyText("DN-447220")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("DN-447220");
  });

  it("given the browser refuses > then false, and nothing thrown", async () => {
    withClipboard({
      writeText: async () => {
        throw new Error("Write permission denied.");
      },
    });
    expect(await copyText("DN-447220")).toBe(false);
  });

  it("given no clipboard at all (a phone build) > then false", async () => {
    withClipboard(undefined);
    expect(await copyText("DN-447220")).toBe(false);
  });
});

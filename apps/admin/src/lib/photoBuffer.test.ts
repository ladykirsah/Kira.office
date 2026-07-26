import { describe, it, expect, vi } from "vitest";
import { addToBuffer, uploadBufferInOrder, type BufferPhoto } from "./photoBuffer";

const photo = (id: string): BufferPhoto => ({ id, file: {} as File, url: `blob:${id}` });

describe("addToBuffer", () => {
  it("appends the photo when under the frame limit", () => {
    expect(addToBuffer([photo("a")], photo("b"), 10).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("never exceeds the frame limit (returns the list unchanged when full)", () => {
    const full = [photo("a"), photo("b")];
    expect(addToBuffer(full, photo("c"), 2)).toBe(full);
  });
});

describe("uploadBufferInOrder", () => {
  it("uploads every file in order and returns the count", async () => {
    const seen: string[] = [];
    const files = [{ n: "1" }, { n: "2" }, { n: "3" }] as unknown as File[];
    const upload = vi.fn(async (f: File) => {
      seen.push((f as unknown as { n: string }).n);
    });
    const n = await uploadBufferInOrder(files, upload);
    expect(n).toBe(3);
    expect(seen).toEqual(["1", "2", "3"]);
    expect(upload).toHaveBeenCalledTimes(3);
  });

  it("propagates an upload error so Save can surface it", async () => {
    const upload = async () => {
      throw new Error("upload boom");
    };
    await expect(uploadBufferInOrder([{} as File], upload)).rejects.toThrow("upload boom");
  });
});

import { describe, it, expect } from "vitest";
import { centredSquareCrop } from "./squareCrop";

describe("centredSquareCrop", () => {
  it("given a landscape image > crops the middle, trimming left and right equally", () => {
    expect(centredSquareCrop(1000, 600, 1024)).toEqual({
      sx: 200,
      sy: 0,
      side: 600,
      out: 600,
    });
  });

  it("given a portrait image > crops the middle, trimming top and bottom equally", () => {
    expect(centredSquareCrop(600, 1000, 1024)).toEqual({
      sx: 0,
      sy: 200,
      side: 600,
      out: 600,
    });
  });

  it("given an already-square image > takes it whole with no crop", () => {
    expect(centredSquareCrop(800, 800, 1024)).toEqual({ sx: 0, sy: 0, side: 800, out: 800 });
  });

  it("given an odd overhang > floors the offset so the crop stays inside the image", () => {
    // 501x300: overhang 201 -> 100.5 per side. Must floor, or sx+side exceeds the width.
    const r = centredSquareCrop(501, 300, 1024);
    expect(r.sx + r.side).toBeLessThanOrEqual(501);
    expect(r).toEqual({ sx: 100, sy: 0, side: 300, out: 300 });
  });

  it("given an image larger than the cap > scales the output down but keeps the full crop", () => {
    // A 4000x3000 phone photo: crop 3000x3000, but write out at most 1024x1024 so a
    // category cover is not a multi-megabyte upload.
    expect(centredSquareCrop(4000, 3000, 1024)).toEqual({
      sx: 500,
      sy: 0,
      side: 3000,
      out: 1024,
    });
  });

  it("given an image smaller than the cap > never upscales", () => {
    expect(centredSquareCrop(200, 300, 1024).out).toBe(200);
  });

  it("given a degenerate size > returns a zero crop rather than NaN", () => {
    expect(centredSquareCrop(0, 500, 1024)).toEqual({ sx: 0, sy: 0, side: 0, out: 0 });
  });
});

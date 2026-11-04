import { describe, expect, it } from "vitest";
import { cameraBoxHeight } from "./cameraFit";

describe("cameraBoxHeight", () => {
  it("given the owner's iPhone camera (about 2:1) in a 370-wide box > then the box takes the camera's shape", () => {
    expect(cameraBoxHeight(370, { width: 1920, height: 980 }, 142)).toBe(189);
  });

  it("given the camera's shape isn't known yet > then the box keeps its usual height", () => {
    expect(cameraBoxHeight(370, null, 142)).toBe(142);
    expect(cameraBoxHeight(0, { width: 1920, height: 1080 }, 142)).toBe(142);
    expect(cameraBoxHeight(370, { width: 0, height: 0 }, 142)).toBe(142);
  });

  it("given a very wide camera > then never flatter than the usual height", () => {
    expect(cameraBoxHeight(370, { width: 3000, height: 600 }, 142)).toBe(142);
  });

  it("given a tall (portrait) camera > then no taller than 4:3, the picture filling it", () => {
    expect(cameraBoxHeight(370, { width: 480, height: 640 }, 142)).toBe(278);
  });
});

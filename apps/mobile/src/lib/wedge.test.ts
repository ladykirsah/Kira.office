import { describe, expect, it } from "vitest";
import { EMPTY_WEDGE, feedKey, sightCode, type Sighting, type Wedge } from "./wedge";

/** Feed keys as a handheld scanner does: one every few milliseconds, starting at `start`. */
function type(keys: string[], start: number, gap: number, from: Wedge = EMPTY_WEDGE) {
  let wedge = from;
  let code: string | null = null;
  keys.forEach((key, i) => {
    const out = feedKey(wedge, key, start + i * gap);
    wedge = out.wedge;
    code = out.code ?? code;
  });
  return { wedge, code };
}

describe("feedKey", () => {
  it("given a handheld scanner typing fast and pressing Enter > then the whole code comes out", () => {
    expect(type([..."8851234567898", "Enter"], 1000, 8).code).toBe("8851234567898");
  });

  it("given a person typing slowly > then it is not mistaken for a scan", () => {
    expect(type([..."885", "Enter"], 1000, 300).code).toBeNull();
  });

  it("given Enter after only two characters > then nothing comes out", () => {
    expect(type(["A", "B", "Enter"], 1000, 8).code).toBeNull();
  });

  it("given keys that are not characters > then they are ignored", () => {
    expect(type(["Shift", ..."AP-1", "Shift", "Enter"], 1000, 8).code).toBe("AP-1");
  });

  it("given a scan has come out > then the next scan starts empty", () => {
    const first = type([..."AAA1", "Enter"], 1000, 8);
    expect(type([..."BBB2", "Enter"], 2000, 8, first.wedge).code).toBe("BBB2");
  });
});

describe("sightCode", () => {
  /** The camera reading every `gap` ms from `start` to `end`; returns how many reads were new scans. */
  function hold(
    code: string,
    start: number,
    end: number,
    gap: number,
    from: Sighting | null = null,
  ) {
    let last = from;
    let scans = 0;
    for (let at = start; at <= end; at += gap) {
      const out = sightCode(last, code, at);
      last = out.last;
      if (out.isNew) scans += 1;
    }
    return { scans, last };
  }

  it("given a label held in front of the camera for five seconds > then it is one scan", () => {
    expect(hold("885", 1000, 6000, 500).scans).toBe(1);
  });

  it("given the label leaves the camera for two seconds and comes back > then it is a new scan", () => {
    const first = hold("885", 1000, 3000, 500);
    expect(sightCode(first.last, "885", 5000).isNew).toBe(true);
  });

  it("given a different code or no earlier read > then it is a new scan", () => {
    expect(sightCode({ code: "885", at: 1000 }, "886", 1200).isNew).toBe(true);
    expect(sightCode(null, "885", 1000).isNew).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { oneAtATime } from "./oneAtATime";

/** A save the test finishes by hand. */
function held() {
  let finish!: () => void;
  let fail!: (e: Error) => void;
  const done = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { done, finish, fail };
}

describe("oneAtATime", () => {
  it("given two saves asked for at once > then the second starts only after the first ends", async () => {
    const saves = oneAtATime();
    const first = held();
    const started: string[] = [];
    void saves.run(() => (started.push("first"), first.done));
    const second = saves.run(async () => void started.push("second"));
    await Promise.resolve();
    expect(started).toEqual(["first"]);
    first.finish();
    await second;
    expect(started).toEqual(["first", "second"]);
  });

  it("given saves still waiting > then it is not idle until the last one is done", async () => {
    const saves = oneAtATime();
    const first = held();
    const a = saves.run(() => first.done);
    const b = saves.run(async () => undefined);
    expect(saves.idle()).toBe(false);
    first.finish();
    await a;
    expect(saves.idle()).toBe(false);
    await b;
    expect(saves.idle()).toBe(true);
  });

  it("given the first save fails > then its caller gets the error and the next still runs", async () => {
    const saves = oneAtATime();
    const first = held();
    const a = saves.run(() => first.done);
    const b = saves.run(async () => "saved");
    first.fail(new Error("down"));
    await expect(a).rejects.toThrow("down");
    await expect(b).resolves.toBe("saved");
    expect(saves.idle()).toBe(true);
  });
});

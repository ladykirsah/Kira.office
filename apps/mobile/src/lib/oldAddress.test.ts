import { describe, expect, it } from "vitest";
import { newAddressFor } from "./oldAddress";

// Den Air's back office moved to teampit.formulal.cc (owner, 19 Nov 2026: pick B; 20 Nov: "no more
// admin.airplusauto.com, only teampit.formulal.cc"). A browser keeps saved data per address, so a
// phone holding bills that have not been sent yet under the old address must send them from there
// first. The old address moves each phone to the same page on the new one once nothing waits.

const saved =
  (values: Record<string, string> = {}) =>
  async (key: string) =>
    values[key] ?? null;
const OLD = "https://admin.airplusauto.com";
const waitingBill = JSON.stringify([{ sale: { clientUuid: "u1" }, status: "waiting" }]);

describe("newAddressFor > where a page on the old address goes", () => {
  it("given the old address and no bill waiting > then the same page on teampit.formulal.cc", async () => {
    expect(await newAddressFor(`${OLD}/orders/123?tab=paid#top`, saved())).toBe(
      "https://teampit.formulal.cc/orders/123?tab=paid#top",
    );
    expect(await newAddressFor(`${OLD}/`, saved({ teampit_pos_queue: "[]" }))).toBe(
      "https://teampit.formulal.cc/",
    );
  });

  it("given a bill still waiting on this phone > then it stays until the bill is sent", async () => {
    expect(await newAddressFor(`${OLD}/pos`, saved({ teampit_pos_queue: waitingBill }))).toBeNull();
  });

  it("given a bill waiting under the old kira_ name > then it stays too", async () => {
    expect(await newAddressFor(`${OLD}/`, saved({ kira_pos_queue: waitingBill }))).toBeNull();
  });

  it("given waiting bills that can't be read > then it stays: moving could strand a bill", async () => {
    expect(await newAddressFor(`${OLD}/`, saved({ teampit_pos_queue: "{broken" }))).toBeNull();
    const refuses = async () => {
      throw new Error("storage blocked");
    };
    expect(await newAddressFor(`${OLD}/`, refuses)).toBeNull();
  });

  it("given the new address, a practice copy or no address > then nothing moves", async () => {
    expect(await newAddressFor("https://teampit.formulal.cc/", saved())).toBeNull();
    expect(await newAddressFor("http://localhost:8081/", saved())).toBeNull();
    expect(await newAddressFor("not a web address", saved())).toBeNull();
  });
});

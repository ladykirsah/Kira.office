import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it("given a first and last name > then it is both first letters, capitalised", () => {
    expect(initials("kirsah somboon")).toBe("KS");
  });

  it("given one name > then it is that name's first letter", () => {
    expect(initials("Kira")).toBe("K");
  });

  it("given a Thai word starting with a leading vowel > then the vowel is skipped for the consonant", () => {
    expect(initials("สมชาย ใจดี")).toBe("สจ");
  });

  it("given more than two names > then only the first two count", () => {
    expect(initials("Anan Chai Dee")).toBe("AC");
  });

  it("given an empty name > then it shows a question mark", () => {
    expect(initials("   ")).toBe("?");
  });
});

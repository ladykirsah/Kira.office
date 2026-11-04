import { describe, expect, it } from "vitest";
import { entryScriptOf, hasNewVersion, runningEntry } from "./appUpdate";

const page = (hash: string) =>
  `<!DOCTYPE html><html><head><title>CrewEngine</title></head><body><div id="root"></div>` +
  `<script src="/_expo/static/js/web/entry-${hash}.js" defer></script></body></html>`;

describe("entryScriptOf", () => {
  it("given the website's page > then the app bundle it loads", () => {
    expect(entryScriptOf(page("a1b2c3"))).toBe("/_expo/static/js/web/entry-a1b2c3.js");
  });

  it("given a page with no app bundle (an error page, the dev server) > then null", () => {
    expect(entryScriptOf("<html><body>502 Bad Gateway</body></html>")).toBeNull();
    expect(
      entryScriptOf('<script src="/node_modules/expo-router/entry.bundle?platform=web">'),
    ).toBeNull();
  });
});

describe("runningEntry", () => {
  it("given the scripts on the open page (full addresses) > then the app bundle's path", () => {
    expect(
      runningEntry([
        "https://admin.airplusauto.com/_expo/static/js/web/__common-9f.js",
        "https://admin.airplusauto.com/_expo/static/js/web/entry-a1b2c3.js",
      ]),
    ).toBe("/_expo/static/js/web/entry-a1b2c3.js");
  });

  it("given no app bundle among them > then null", () => {
    expect(
      runningEntry(["http://localhost:8081/node_modules/expo-router/entry.bundle"]),
    ).toBeNull();
    expect(runningEntry([])).toBeNull();
  });
});

describe("hasNewVersion", () => {
  it("given the website now serves another bundle > then there is a new version", () => {
    expect(hasNewVersion("/_expo/static/js/web/entry-a1b2c3.js", page("d4e5f6"))).toBe(true);
  });

  it("given the same bundle > then nothing new", () => {
    expect(hasNewVersion("/_expo/static/js/web/entry-a1b2c3.js", page("a1b2c3"))).toBe(false);
  });

  it("given it cannot tell (not running a built app, or the page came back broken) > then no bar", () => {
    expect(hasNewVersion(null, page("d4e5f6"))).toBe(false);
    expect(hasNewVersion("/_expo/static/js/web/entry-a1b2c3.js", "")).toBe(false);
  });
});

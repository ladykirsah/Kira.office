import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Owner, 3 Nov 2026: "i want all button label to be simple just like most approved pages",
// "ยกเลิก is an example". A button never names an amount or a count: the sheet above it does.

const UI = __dirname;
const MONEY_OR_COUNT = /formatBaht|money\(|total|amount|count|length|satang/i;

function screens(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? screens(join(dir, e.name))
      : e.name.endsWith(".tsx")
        ? [join(dir, e.name)]
        : [],
  );
}

/** The Thai words of every label that something presses: its next prop is onPress / onConfirm. */
function pressedLabels(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/\blabel\s*(?::|=\{)/g)) {
    const rest = code.slice(m.index + m[0].length);
    const end = rest.search(/\bon(?:Press|Confirm)\b|\/>|\blabel\s*(?::|=)|\btitle\s*:/);
    if (end < 0 || !/^on/.test(rest.slice(end))) continue;
    for (const th of rest.slice(0, end).matchAll(/th:\s*`([^`]*)`/g)) out.push(th[1]!);
  }
  return out;
}

function namesMoneyOrCount(words: string): boolean {
  if (words.includes("฿")) return true;
  return [...words.matchAll(/\$\{([^}]*)\}/g)].some((x) => MONEY_OR_COUNT.test(x[1]!));
}

describe("button labels", () => {
  it("every pressed label in the app > given any screen > then none names an amount or a count", () => {
    const offenders = screens(UI).flatMap((file) =>
      pressedLabels(readFileSync(file, "utf8"))
        .filter(namesMoneyOrCount)
        .map((words) => `${relative(UI, file)}: ${words}`),
    );
    expect(offenders).toEqual([]);
  });

  it("the check > given a pinned money button > then it catches the amount", () => {
    const pin = "label: t({ th: `ยืนยันการชำระเงิน ${total}`, en: `Pay ${total}` }), onPress: go";
    expect(pressedLabels(pin).filter(namesMoneyOrCount)).toEqual(["ยืนยันการชำระเงิน ${total}"]);
  });

  it("the check > given a count on a BigButton > then it catches the count", () => {
    const big =
      "<BigButton label={t({ th: `ล้าง ${sum.count} รายการ`, en: `Clear` })} onPress={go} />";
    expect(pressedLabels(big).filter(namesMoneyOrCount)).toEqual(["ล้าง ${sum.count} รายการ"]);
  });

  it("the check > given a row with an amount but nothing to press > then it is not a button", () => {
    const row = "<Line label={t({ th: `ลูกค้าโอน ${formatBaht(x)}`, en: `Paid` })} value={v} />";
    expect(pressedLabels(row)).toEqual([]);
  });
});

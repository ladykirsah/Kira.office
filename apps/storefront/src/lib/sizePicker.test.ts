import { describe, it, expect } from "vitest";
import type { CampaignPriceInfo } from "@l-shopee/core";
import {
  canConfirm,
  cardSizeLine,
  chipLabel,
  chipState,
  choicePrice,
  clampQty,
  hasSizes,
  priceRange,
  rangeText,
  sheetHead,
  sizeLabel,
  type PickChoice,
} from "./sizePicker";

/**
 * ตัวเลือกสินค้า on AirPlus (board 3b, owner's picks 11 Nov 2026): card "3 ขนาด · เริ่ม ฿30", the product
 * page's ฿30 – ฿40 range, and the Shopee-style size sheet (chips, sold-out chip, button grey until a
 * size is picked). Real O-ring sizes and Shopee prices.
 */

const NOW = Date.UTC(2026, 10, 11, 10);
const HOUR = 60 * 60 * 1000;

function size(
  id: string,
  value: string | null,
  baht: number,
  onHand: number,
  extra: Partial<PickChoice> = {},
): PickChoice {
  return {
    variantId: id,
    optionName: value ? "ขนาด" : null,
    value,
    imageKey: `img/${id}.jpg`,
    priceSatang: baht * 100,
    onHand,
    campaign: null,
    ...extra,
  };
}

const flash = (baht: number, extra: Partial<CampaignPriceInfo> = {}): CampaignPriceInfo => ({
  campaignPriceSatang: baht * 100,
  startsAt: NOW - HOUR,
  endsAt: NOW + HOUR,
  status: "active",
  stockCap: null,
  soldCount: 0,
  ...extra,
});

const ORING = [
  size("s38", "3/8 เล็ก", 30, 100),
  size("s12", "1/2 กลาง", 40, 100),
  size("s58", "5/8 ใหญ่", 40, 100),
];

describe("sizeLabel", () => {
  it("given a size > then it reads ขนาด and the size", () => {
    expect(sizeLabel("1/2 กลาง")).toBe("ขนาด 1/2 กลาง");
  });

  it("given the shop named the option something else > then that name leads", () => {
    expect(sizeLabel("แพ็ค 10", "แบบ")).toBe("แบบ แพ็ค 10");
  });
});

describe("hasSizes", () => {
  it("given the O-ring's three sizes > then it has sizes", () => {
    expect(hasSizes(ORING)).toBe(true);
  });

  it("given a normal product's one variant with no option > then it has none", () => {
    expect(hasSizes([size("v1", null, 450, 5)])).toBe(false);
  });
});

describe("cardSizeLine", () => {
  it("given 3 sizes > then the card says 3 ขนาด", () => {
    expect(cardSizeLine(3)).toBe("3 ขนาด");
  });

  it("given a normal product > then the card says nothing extra", () => {
    expect(cardSizeLine(1)).toBeNull();
  });
});

describe("choicePrice", () => {
  it("given a size on a live flash sale > then its price is the flash price", () => {
    expect(choicePrice(size("s12", "1/2 กลาง", 40, 100, { campaign: flash(35) }), NOW)).toBe(3500);
  });

  it("given a flash sale that has ended > then its price is the normal one", () => {
    const ended = flash(35, { startsAt: NOW - 3 * HOUR, endsAt: NOW - HOUR });
    expect(choicePrice(size("s12", "1/2 กลาง", 40, 100, { campaign: ended }), NOW)).toBe(4000);
  });
});

describe("priceRange + rangeText", () => {
  it("given the O-ring at ฿30, ฿40, ฿40 > then the page shows ฿30 – ฿40", () => {
    const range = priceRange(ORING, NOW);
    expect(range).toEqual({ lowSatang: 3000, highSatang: 4000 });
    expect(rangeText(range!)).toBe("฿30 – ฿40");
  });

  it("given the cheapest size is sold out > then the range covers only sizes you can buy", () => {
    const sizes = [size("s38", "3/8 เล็ก", 30, 0), ORING[1]!, ORING[2]!];
    expect(rangeText(priceRange(sizes, NOW)!)).toBe("฿40");
  });

  it("given a flash price on one size > then the range starts at the flash price", () => {
    const sizes = [ORING[0]!, size("s12", "1/2 กลาง", 40, 100, { campaign: flash(25) }), ORING[2]!];
    expect(rangeText(priceRange(sizes, NOW)!)).toBe("฿25 – ฿40");
  });

  it("given every size sold out > then there is no range", () => {
    expect(priceRange([size("a", "A", 30, 0), size("b", "B", 40, 0)], NOW)).toBeNull();
  });
});

describe("chipState", () => {
  it("given the size you tapped > then its chip is picked", () => {
    expect(chipState(ORING[1]!, "s12")).toBe("picked");
  });

  it("given another size in stock > then its chip is open", () => {
    expect(chipState(ORING[0]!, "s12")).toBe("open");
  });

  it("given a sold-out size > then its chip is out, even if it was picked", () => {
    expect(chipState(size("s58", "5/8 ใหญ่", 40, 0), "s58")).toBe("out");
  });
});

describe("canConfirm", () => {
  it("given no size picked yet > then the sheet's button stays grey", () => {
    expect(canConfirm(ORING, null)).toBe(false);
  });

  it("given a size in stock picked > then the button turns red", () => {
    expect(canConfirm(ORING, "s12")).toBe(true);
  });

  it("given a picked size that sold out meanwhile > then the button stays grey", () => {
    expect(canConfirm([size("s12", "1/2 กลาง", 40, 0)], "s12")).toBe(false);
  });
});

describe("clampQty", () => {
  it("given less than one > then it is one", () => {
    expect(clampQty(0, 100)).toBe(1);
  });

  it("given more than is in stock > then it stops at the stock", () => {
    expect(clampQty(8, 7)).toBe(7);
  });

  it("given a number in between > then it stays", () => {
    expect(clampQty(3, 7)).toBe(3);
  });
});

describe("sheetHead", () => {
  it("given no size picked > then the sheet shows the range and asks for a size, with the first size's photo", () => {
    expect(sheetHead(ORING, null, NOW)).toEqual({
      imageKey: "img/s38.jpg",
      price: "฿30 – ฿40",
      sub: "เลือกขนาด",
    });
  });

  it("given 1/2 กลาง picked > then its photo, price and stock show", () => {
    expect(sheetHead(ORING, "s12", NOW)).toEqual({
      imageKey: "img/s12.jpg",
      price: "฿40",
      sub: "เหลือ 100 ชิ้น · ขนาด 1/2 กลาง",
    });
  });

  it("given the picked size is on flash sale > then its flash price shows", () => {
    const sizes = [ORING[0]!, size("s12", "1/2 กลาง", 40, 7, { campaign: flash(35) }), ORING[2]!];
    expect(sheetHead(sizes, "s12", NOW)).toMatchObject({
      price: "฿35",
      sub: "เหลือ 7 ชิ้น · ขนาด 1/2 กลาง",
    });
  });
});

describe("chipLabel", () => {
  // owner, 14 Nov 2026: "remove the price from the choice frame" — the chip holds the size only
  it("chipLabel > given an open or picked size > the size alone, no price", () => {
    expect(chipLabel({ value: "3/8 เล็ก" }, "open")).toBe("3/8 เล็ก");
    expect(chipLabel({ value: "1/2 กลาง" }, "picked")).toBe("1/2 กลาง");
  });
  it("chipLabel > given a sold-out size > the size · หมด", () => {
    expect(chipLabel({ value: "5/8 ใหญ่" }, "out")).toBe("5/8 ใหญ่ · หมด");
  });
});

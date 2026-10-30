import { describe, expect, it } from "vitest";
import type { OrderDetail } from "./ordersApi";
import {
  LABEL_PAGE,
  labelPageLayout,
  shippingLabel,
  shippingLabelFileName,
  type LabelShop,
} from "./shippingLabel";

const shop: LabelShop = {
  name: "AirPlus Auto",
  phone: "02-123-4567",
  address: "99/1 ถ.งามวงศ์วาน อ.เมืองนนทบุรี จ.นนทบุรี",
  postcode: "11000",
  lineUrl: "https://lin.ee/tltIFtI",
  headline: "",
  subtitle: "",
};

type LabelOrder = Pick<OrderDetail, "order" | "address" | "lines">;

const line = (over: Partial<OrderDetail["lines"][number]>): OrderDetail["lines"][number] => ({
  id: "l1",
  name: "แผงแอร์ Toyota Vigo ดีเซล",
  brand: "DENSO",
  sku: "TY-VIGO-CD",
  imageKey: null,
  variantName: null,
  productRef: null,
  quantity: 1,
  unitPriceSatang: 354000,
  lineTotalSatang: 354000,
  ...over,
});

const order = (paymentStatus: string, over: Partial<LabelOrder> = {}): LabelOrder => ({
  order: {
    externalOrderId: "AP-1042",
    paymentStatus,
    grandTotalSatang: 129000,
  } as OrderDetail["order"],
  address: {
    recipientName: "คุณสุดา ทองดี",
    phone: "089-555-0142",
    addressLine1: "45/7 ถ.รัตนาธิเบศร์",
    subdistrict: "ต.บางกระสอ",
    district: "อ.เมืองนนทบุรี",
    province: "จ.นนทบุรี",
    postalCode: "11000",
  },
  lines: [line({})],
  ...over,
});

describe("shippingLabel", () => {
  it("given an order > then the receiver is its name and phone, over the address on one line", () => {
    expect(shippingLabel(order("paid"), shop).to).toEqual({
      title: "คุณสุดา ทองดี • 089-555-0142",
      address: "45/7 ถ.รัตนาธิเบศร์ ต.บางกระสอ อ.เมืองนนทบุรี จ.นนทบุรี 11000",
    });
  });

  it("given the shop's details > then the sender is the shop with its phone, address and postcode", () => {
    expect(shippingLabel(order("paid"), shop).from).toEqual({
      title: "AirPlus Auto • 02-123-4567",
      address: "99/1 ถ.งามวงศ์วาน อ.เมืองนนทบุรี จ.นนทบุรี 11000",
    });
  });

  it("given no shop name or phone saved yet > then the sender still reads AirPlus Auto", () => {
    const blank = { ...shop, name: "", phone: "", postcode: "" };
    expect(shippingLabel(order("paid"), blank).from.title).toBe("AirPlus Auto");
  });

  it("given an order with no address > then the label says so instead of printing blank", () => {
    expect(shippingLabel(order("paid", { address: null }), shop).to).toEqual({
      title: "—",
      address: "ไม่มีที่อยู่ในออเดอร์นี้",
    });
  });

  it("given the items > then each is its name, brand and count; a missing brand shows a dash", () => {
    const lines = [
      line({}),
      line({ id: "l2", name: null, sku: "AC-GAS-R134A", brand: null, quantity: 2 }),
    ];
    expect(shippingLabel(order("paid", { lines }), shop).items).toEqual([
      { id: "l1", name: "แผงแอร์ Toyota Vigo ดีเซล", brand: "DENSO", quantity: 1 },
      { id: "l2", name: "AC-GAS-R134A", brand: "—", quantity: 2 },
    ]);
  });

  it("given cash on delivery > then the label carries the amount to collect", () => {
    expect(shippingLabel(order("cod"), shop).codSatang).toBe(129000);
    expect(shippingLabel(order("cod_confirmed"), shop).codSatang).toBe(129000);
  });

  it("given a paid transfer > then there is nothing to collect on the label", () => {
    expect(shippingLabel(order("paid"), shop).codSatang).toBeNull();
  });

  it("given the shop's LINE link > then the QR opens LINE", () => {
    expect(shippingLabel(order("paid"), shop).qr).toEqual({
      url: "https://lin.ee/tltIFtI",
      isLine: true,
    });
  });

  it("given no LINE link saved > then the QR opens the website instead", () => {
    expect(shippingLabel(order("paid"), { ...shop, lineUrl: " " }).qr).toEqual({
      url: "https://airplusauto.com",
      isLine: false,
    });
  });

  it("given no thank-you words saved > then the shop's usual ones are used", () => {
    expect(shippingLabel(order("paid"), shop).thanks).toEqual({
      headline: "ขอบคุณที่อุดหนุนสินค้าของเรา",
      subtitle: "สแกนเพื่อปรึกษาช่าง หรือ สั่งอะไหล่เพิ่มเติม",
    });
    const own = { ...shop, headline: "ขอบคุณครับ", subtitle: "ทักไลน์ได้เลย" };
    expect(shippingLabel(order("paid"), own).thanks).toEqual({
      headline: "ขอบคุณครับ",
      subtitle: "ทักไลน์ได้เลย",
    });
  });
});

describe("shippingLabelFileName", () => {
  it("given an order number > then the file is named after it", () => {
    expect(shippingLabelFileName("pdf", "AP-1042")).toBe("label-AP-1042.pdf");
    expect(shippingLabelFileName("png", "AP-1042")).toBe("label-AP-1042.png");
  });

  it("given characters a file system will not take > then they become one dash", () => {
    expect(shippingLabelFileName("pdf", " AP/10:42 ")).toBe("label-AP-10-42.pdf");
  });

  it("given no order number > then the name is still usable", () => {
    expect(shippingLabelFileName("png", "")).toBe("label.png");
  });
});

/** A capture 1000px wide and `ratio`× as tall. */
const capture = (ratio: number) => ({ width: 1000, height: 1000 * ratio });

describe("labelPageLayout", () => {
  it("given any label > then the page is always 100 × 150 mm, one sticker size for every parcel", () => {
    for (const ratio of [0.8, 1.5, 3])
      expect(labelPageLayout(capture(ratio)).page).toEqual(LABEL_PAGE);
    expect(LABEL_PAGE).toEqual({ w: 100, h: 150 });
  });

  it("given a label shorter than the page > then it fills the width from the top", () => {
    const out = labelPageLayout(capture(1));
    expect(out).toMatchObject({ x: 0, y: 0, w: 100 });
    expect(out.h).toBeCloseTo(100, 5);
  });

  it("given a long item list > then it shrinks to fit and stays centred, never cropped", () => {
    const out = labelPageLayout(capture(3));
    expect(out.h).toBeCloseTo(150, 5);
    expect(out.w).toBeCloseTo(50, 5);
    expect(out.x).toBeCloseTo(25, 5);
  });

  it("given a capture that was never laid out > then it fills the page instead of a blank sheet", () => {
    expect(labelPageLayout({ width: 0, height: 0 })).toMatchObject({ x: 0, y: 0, w: 100, h: 150 });
  });
});

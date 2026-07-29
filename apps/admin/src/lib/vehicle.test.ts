import { describe, it, expect } from "vitest";
import { parseSavedCar } from "./vehicle";

const brands = [
  { id: "b-toyota", name: "Toyota", models: [{ id: "m-vigo", name: "Vigo" }] },
  { id: "b-mb", name: "Mercedes Benz", models: [{ id: "m-c200", name: "C200" }] },
];

describe("parseSavedCar", () => {
  it("reads back the car POS saved, so Vehicle prefills next visit", () => {
    expect(parseSavedCar("Toyota Vigo 2012", brands)).toEqual({
      brandId: "b-toyota",
      modelId: "m-vigo",
      year: "2012",
    });
  });

  it("given no year > still prefills brand and model", () => {
    expect(parseSavedCar("Toyota Vigo", brands)).toEqual({
      brandId: "b-toyota",
      modelId: "m-vigo",
      year: "",
    });
  });

  it("given a brand whose name has spaces > matches the longer name first", () => {
    expect(parseSavedCar("Mercedes Benz C200 2015", brands)).toEqual({
      brandId: "b-mb",
      modelId: "m-c200",
      year: "2015",
    });
  });

  it("given a model the fitment tree doesn't know > prefills the brand only", () => {
    expect(parseSavedCar("Toyota Hilux 2019", brands)).toEqual({
      brandId: "b-toyota",
      modelId: "",
      year: "2019",
    });
  });

  it("ignores case and untidy spacing from imported data", () => {
    expect(parseSavedCar("  toyota   vigo  2012 ", brands)).toEqual({
      brandId: "b-toyota",
      modelId: "m-vigo",
      year: "2012",
    });
  });

  it("given nothing recognisable > prefills nothing", () => {
    expect(parseSavedCar("Ford Ranger 2011", brands)).toBeNull();
    expect(parseSavedCar("", brands)).toBeNull();
    expect(parseSavedCar(null, brands)).toBeNull();
  });
});

import { describe, expect, it } from "@jest/globals";
import { isLngLat } from "./IsLngLat";

describe("isLngLat should return true", () => {
  it("when given a valid lng/lat pair", () => {
    expect(isLngLat([0, 0])).toBe(true);
  });
});

describe("should return false", () => {
  it("when given a non-array", () => {
    expect(isLngLat("foo")).toBe(false);
  });

  it("when given an array with length other than 2", () => {
    expect(isLngLat([0])).toBe(false);
    expect(isLngLat([0, 0, 0])).toBe(false);
  });

  it("when given an array with non-numbers", () => {
    expect(isLngLat(["foo", "bar"])).toBe(false);
  });

  it("when given an array with numbers outside of [-180, 180]", () => {
    expect(isLngLat([-181, 0])).toBe(false);
    expect(isLngLat([0, 181])).toBe(false);
  });
});

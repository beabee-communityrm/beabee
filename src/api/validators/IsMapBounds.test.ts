import { describe, expect, it } from "@jest/globals";
import { isMapBounds } from "./IsMapBounds";

describe("isMapBounds should return true", () => {
  it("when given a valid bounds", () => {
    expect(
      isMapBounds([
        [0, 0],
        [0, 0]
      ])
    ).toBe(true);
  });
});

describe("should return false", () => {
  it("when given a non-array", () => {
    expect(isMapBounds("foo")).toBe(false);
  });

  it("when given an array with length other than 2", () => {
    expect(isMapBounds([0])).toBe(false);
    expect(isMapBounds([0, 0, 0])).toBe(false);
  });

  it("when given an array with non-LngLat", () => {
    expect(isMapBounds(["foo", "bar"])).toBe(false);
  });

  it("when given an array with LngLat outside of [-180, 180]", () => {
    expect(
      isMapBounds([
        [-181, 0],
        [0, 0]
      ])
    ).toBe(false);
    expect(
      isMapBounds([
        [0, 0],
        [0, 181]
      ])
    ).toBe(false);
  });
});

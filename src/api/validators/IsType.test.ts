import { describe, expect, it } from "@jest/globals";
import { isType } from "./IsType";

describe("isType should return true", () => {
  it("when the value matches the type", () => {
    expect(isType(["string"], "foo")).toBe(true);
  });

  it("when the value matches one of the types", () => {
    expect(isType(["string", "number"], "foo")).toBe(true);
    expect(isType(["string", "number"], 5)).toBe(true);
  });
});

describe("should return false", () => {
  it("when the value does not match the type", () => {
    expect(isType(["string"], 123)).toBe(false);
  });

  it("when the value does not match any of the types", () => {
    expect(isType(["string", "number"], true)).toBe(false);
  });
});

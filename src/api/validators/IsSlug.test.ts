import { describe, expect, it } from "@jest/globals";
import { isSlug } from "./IsSlug";

describe("isSlug should return true", () => {
  it("when given a valid slug", () => {
    expect(isSlug("foo-bar")).toBe(true);
  });

  it("when given a string with uppercase letters", () => {
    expect(isSlug("FooBar")).toBe(true);
  });

  it("when given a string with valid non-alphanumeric characters", () => {
    expect(isSlug("foo_bar")).toBe(true);
  });
});

describe("should return false", () => {
  it("when given a non-string", () => {
    expect(isSlug(123)).toBe(false);
  });

  it("when given a string with forbidden characters", () => {
    expect(isSlug("foo bar ?? &")).toBe(false);
  });
});

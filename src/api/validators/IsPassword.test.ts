import { describe, expect, it } from "@jest/globals";
import { isPassword } from "./IsPassword";

describe("isPassword should return true", () => {
  it("when given a valid password", () => {
    expect(isPassword("Password1")).toBe(true);
  });
});

describe("should return false", () => {
  it("when given a non-string", () => {
    expect(isPassword(123)).toBe(false);
  });

  it("when given a string with length less than 8", () => {
    expect(isPassword("Passwor")).toBe(false);
  });

  it("when given a string without lowercase letters", () => {
    expect(isPassword("PASSWORD1")).toBe(false);
  });

  it("when given a string without uppercase letters", () => {
    expect(isPassword("password1")).toBe(false);
  });

  it("when given a string without numbers", () => {
    expect(isPassword("Password")).toBe(false);
  });
});

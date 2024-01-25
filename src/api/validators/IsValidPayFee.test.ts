import { describe, expect, it } from "@jest/globals";
import { isValidPayFee } from "./IsValidPayFee";
import { ContributionPeriod } from "@beabee/beabee-common";

describe("isValidPayFee should return true", () => {
  it("when given a valid pay fee", () => {
    expect(isValidPayFee(true, 5, ContributionPeriod.Monthly)).toBe(true);
  });
  it("when given a valid pay fee", () => {
    expect(isValidPayFee(false, 20, ContributionPeriod.Monthly)).toBe(true);
  });
  it("when given a valid pay fee", () => {
    expect(isValidPayFee(false, 50, ContributionPeriod.Annually)).toBe(true);
  });
});

describe("should return false", () => {
  it("when given invalid arguments non-boolean", () => {
    expect(isValidPayFee("foo", "blah", "blah")).toBe(false);
  });

  it("when trying to pay a fee for an annual contribution", () => {
    expect(isValidPayFee(true, 50, ContributionPeriod.Annually)).toBe(false);
  });

  it("when trying to not pay a fee for a monthly contribution of £1", () => {
    expect(isValidPayFee(false, 1, ContributionPeriod.Monthly)).toBe(false);
  });
});

import { describe, expect, it } from "@jest/globals";
import { minContributionAmount } from "./MinContributionAmount";

describe("minContributionAmount should return true", () => {
  it("when given a valid contribution amount for monthly", () => {
    expect(minContributionAmount(5, "monthly", 5)).toBe(true);
    expect(minContributionAmount(7, "monthly", 5)).toBe(true);
  });

  it("when given a valid contribution amount for annual", () => {
    expect(minContributionAmount(60, "annually", 5)).toBe(true);
    expect(minContributionAmount(70, "annually", 5)).toBe(true);
  });
});

describe("should return false", () => {
  it("when given invalid arguments non-number", () => {
    expect(minContributionAmount("foo", "monthly", 5)).toBe(false);
  });

  it("when given invalid arguments non-enum", () => {
    expect(minContributionAmount(5, "foo", 5)).toBe(false);
  });

  it("when given a contribution amount less than the minimum monthly amount", () => {
    expect(minContributionAmount(1, "monthly", 2)).toBe(false);
  });

  it("when given a contribution amount less than the minimum annual amount", () => {
    expect(minContributionAmount(11, "annually", 1)).toBe(false);
  });
});

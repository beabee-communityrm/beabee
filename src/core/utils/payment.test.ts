import { describe, expect, test } from "@jest/globals";

import { ContributionPeriod, ContributionType } from "@beabee/beabee-common";
import { add, sub } from "date-fns";

import { calcRenewalDate } from "./payment";
import Contact from "#models/Contact";
import ContactRole from "#models/ContactRole";
import Password from "#models/Password";

import config from "#config";

function createContact(contact?: Partial<Contact>): Contact {
  return Object.assign(new Contact(), {
    referralCode: "AB123",
    pollsCode: "AB234",
    roles: [],
    password: Password.none,
    email: "test@example.com",
    firstname: "",
    lastname: "",
    contributionType: ContributionType.Manual,
    contributionPeriod: ContributionPeriod.Monthly,
    ...contact
  });
}

function createRole(role?: Partial<ContactRole>): ContactRole {
  return Object.assign(new ContactRole(), {
    type: "member",
    dateAdded: new Date(),
    ...role
  });
}

describe("Renewal calculation should be", () => {
  const now = new Date();

  const oneYearAgo = sub(now, { years: 1 });
  const oneMonthAgo = sub(now, { months: 1 });
  const oneMonthFromNow = add(now, { months: 1 });
  const twoYearsFromNow = add(now, { years: 2 });

  test("undefined if contact has no contribution", () => {
    const contact = createContact({ contributionType: ContributionType.None });
    expect(calcRenewalDate(contact, now)).toBeUndefined();
  });

  test("undefined if contact has an inactive membership", () => {
    const contact = createContact({
      roles: [createRole({ dateAdded: oneYearAgo, dateExpires: oneMonthAgo })]
    });
    expect(calcRenewalDate(contact, now)).toBeUndefined();
  });

  test("expiry date minus grace period if membership has an expiry date", () => {
    const contact = createContact({
      contributionType: ContributionType.Manual,
      roles: [
        createRole({ dateAdded: oneYearAgo, dateExpires: oneMonthFromNow })
      ]
    });
    expect(calcRenewalDate(contact, now)).toEqual(
      sub(oneMonthFromNow, config.gracePeriod)
    );
  });

  test("a maximum of one contribution period if the expiry date is too far in the future", () => {
    const contact = createContact({
      contributionType: ContributionType.Manual,
      contributionPeriod: ContributionPeriod.Annually,
      roles: [
        createRole({ dateAdded: oneYearAgo, dateExpires: twoYearsFromNow })
      ]
    });
    expect(calcRenewalDate(contact, now)).toEqual(add(now, { years: 1 }));
  });

  test("a month away if the membership has no expiry date and is monthly", () => {
    const contact = createContact({
      roles: [createRole({ dateAdded: oneYearAgo })]
    });
    expect(calcRenewalDate(contact, now)).toEqual(oneMonthFromNow);
  });

  test("next year if the membership has no expiry date, is annual and the date has passed this year", () => {
    const contact = createContact({
      contributionPeriod: ContributionPeriod.Annually,
      roles: [createRole({ dateAdded: sub(oneYearAgo, { days: 5 }) })]
    });
    expect(calcRenewalDate(contact, now)).toEqual(
      add(now, { years: 1, days: -5 })
    );
  });

  test("this year if membership has no expiry date, is annual and date has not passed this year", () => {
    const oneYearAgoAnd5Days = add(oneYearAgo, { days: 5 });
    const contact = createContact({
      contributionPeriod: ContributionPeriod.Annually,
      roles: [createRole({ dateAdded: oneYearAgoAnd5Days })]
    });
    expect(calcRenewalDate(contact, now)).toEqual(
      add(oneYearAgoAnd5Days, { years: 1 })
    );
  });
});

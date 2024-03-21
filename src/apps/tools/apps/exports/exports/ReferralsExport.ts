import { SelectQueryBuilder } from "typeorm";

import { createQueryBuilder } from "#core/database";

import Contact from "#models/Contact";
import Referral from "#models/Referral";

import BaseExport, { ExportResult } from "./BaseExport";

function contactDetails(contact: Contact | null) {
  return contact
    ? [
        contact.email,
        contact.firstname,
        contact.lastname,
        ...(contact.profile.deliveryOptIn && contact.profile.deliveryAddress
          ? [
              contact.profile.deliveryAddress.line1,
              contact.profile.deliveryAddress.line2,
              contact.profile.deliveryAddress.city,
              contact.profile.deliveryAddress.postcode
            ]
          : ["", "", "", ""])
      ]
    : ["", "", "", "", "", "", ""];
}

export default class ReferralsExport extends BaseExport<Referral> {
  exportName = "Referrals export";
  itemName = "referrals";
  itemStatuses = ["added", "seen"];
  idColumn = "r.id";

  protected get query(): SelectQueryBuilder<Referral> {
    return createQueryBuilder(Referral, "r")
      .leftJoinAndSelect("r.referrer", "referrer")
      .leftJoinAndSelect("r.referee", "referee")
      .leftJoinAndSelect("referrer.profile", "p1")
      .leftJoinAndSelect("referee.profile", "p2")
      .orderBy("r.date");
  }

  async getExport(referrals: Referral[]): Promise<ExportResult> {
    const giftOptions = referrals
      .map((referral) => [
        ...Object.keys(referral.referrerGiftOptions || {}),
        ...Object.keys(referral.refereeGiftOptions || {})
      ])
      .reduce((a, b) => [...a, ...b], [])
      .filter((opt, i, arr) => arr.indexOf(opt) === i); // deduplicate

    const fields = [
      "Date",
      "Type",
      "Email",
      "FirstName",
      "LastName",
      "Address1",
      "Address2",
      "City",
      "Postcode",
      "RefereeAmount",
      "Gift",
      ...giftOptions
    ];

    const data = referrals
      .map((referral) => {
        const referrer = referral.referrer;
        const referee = referral.referee;

        return [
          [
            referral.date.toISOString(),
            "Referrer",
            ...contactDetails(referrer),
            referral.refereeAmount,
            referral.referrerGift,
            ...giftOptions.map(
              (opt) => (referral.referrerGiftOptions || { [opt]: "" })[opt]
            )
          ],
          [
            referral.date.toISOString(),
            "Referee",
            ...contactDetails(referee),
            referral.refereeAmount,
            referral.refereeGift,
            ...giftOptions.map(
              (opt) => (referral.refereeGiftOptions || { [opt]: "" })[opt]
            )
          ]
        ];
      })
      .reduce((a, b) => [...a, ...b], []);

    return { fields, data };
  }
}

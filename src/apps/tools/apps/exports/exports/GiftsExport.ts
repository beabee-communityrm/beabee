import { ContributionType } from "@beabee/beabee-common";
import { SelectQueryBuilder } from "typeorm";

import { createQueryBuilder } from "#core/database";

import Address from "#models/Address";
import GiftFlow from "#models/GiftFlow";

import BaseExport, { ExportResult } from "./BaseExport";

function addressFields(address: Address | null) {
  return {
    GifteeAddress1: address?.line1 || "",
    GifteeAddress2: address?.line2 || "",
    GifteeCity: address?.city || "",
    GifteePostcode: address?.postcode?.trim().toUpperCase() || ""
  };
}

export default class GiftsExport extends BaseExport<GiftFlow> {
  exportName = "Gifts export";
  itemStatuses = ["added", "seen", "sent"];
  itemName = "gifts";
  idColumn = "g.id";

  protected get query(): SelectQueryBuilder<GiftFlow> {
    return createQueryBuilder(GiftFlow, "g")
      .leftJoinAndSelect("g.giftee", "giftee")
      .leftJoinAndSelect("giftee.roles", "roles")
      .leftJoinAndSelect("giftee.profile", "profile")
      .orderBy("g.date");
  }

  protected getNewItemsQuery(): SelectQueryBuilder<GiftFlow> {
    return super.getNewItemsQuery().andWhere("g.completed = TRUE");
  }

  async getExport(giftFlows: GiftFlow[]): Promise<ExportResult> {
    return giftFlows.map(({ date, giftee, giftForm, setupCode }) => {
      const gifteeDetails = giftee
        ? {
          GifteeName: giftee.fullname,
          GifteeFirstName: giftee.firstname,
          GifteeEmail: giftee.email,
          GifteeExpiryDate: giftee.roles
            .find((p) => p.type === "member")
            ?.dateExpires?.toISOString(),
          GifteeHasActivated: !giftee.password.hash,
          GifteeHasConverted:
            giftee.contributionType !== ContributionType.Gift,
          ...addressFields(giftee.profile.deliveryAddress)
        }
        : {
          GifteeName: giftForm.firstname + " " + giftForm.lastname,
          GifteeFirstName: giftForm.firstname,
          GifteeEmail: giftForm.email,
          GifteeExpiryDate: "",
          GifteeHasActivated: false,
          GifteeHasConverted: false,
          ...addressFields(giftForm.deliveryAddress)
        };

      return {
        GiftPurchaseDate: date.toISOString(),
        GiftStartDate: giftForm.startDate, // TODO: why is this already a string?
        GiftCode: setupCode,
        GiftHasStarted: !!giftee,
        GifterName: giftForm.fromName,
        GifterEmail: giftForm.fromEmail,
        Message: giftForm.message,
        ...gifteeDetails
      };
    });
  }
}

import { ContributionType } from "@beabee/beabee-common";
import express from "express";
import { getRepository } from "typeorm";

import { hasSchema, isLoggedIn } from "@core/middleware";
import { hasUser, wrapAsync } from "@core/utils";
import { generatePassword } from "@core/utils/auth";

import CalloutsService from "@core/services/CalloutsService";
import ContactsService from "@core/services/ContactsService";
import OptionsService from "@core/services/OptionsService";

import Callout from "@models/Callout";
import Referral from "@models/Referral";

import { completeSchema } from "./schemas.json";

async function getJoinCallout() {
  const calloutId = OptionsService.getText("join-poll");
  return calloutId
    ? await getRepository(Callout).findOne(calloutId)
    : undefined;
}

const app = express();

app.set("views", __dirname + "/views");

app.use(isLoggedIn);

app.get(
  "/",
  wrapAsync(async function (req, res) {
    const referral = await getRepository(Referral).findOne({
      referee: req.user!
    });

    res.render("complete", {
      user: req.user,
      isReferralWithGift: referral && referral.refereeGift,
      isGift: req.user?.contributionType === ContributionType.Gift,
      joinPoll: await getJoinCallout()
    });
  })
);

app.post(
  "/",
  hasSchema(completeSchema).orFlash,
  wrapAsync(
    hasUser(async function (req, res) {
      const {
        body: {
          password,
          delivery_optin,
          delivery_line1,
          delivery_line2,
          delivery_city,
          delivery_postcode
        },
        user
      } = req;

      await ContactsService.updateContact(user, {
        password: await generatePassword(password)
      });

      const referral = await getRepository(Referral).findOne({ referee: user });

      const callout = await getJoinCallout();
      if (callout && req.body.data) {
        await CalloutsService.setResponse(callout, user, req.body.data);
      }

      const needAddress =
        delivery_optin ||
        (referral && referral.refereeGift) ||
        user.contributionType === ContributionType.Gift;
      const gotAddress = delivery_line1 && delivery_city && delivery_postcode;

      if (needAddress && !gotAddress) {
        req.flash("error", "address-required");
        res.redirect(req.originalUrl);
      } else {
        await ContactsService.updateContactProfile(user, {
          deliveryOptIn: delivery_optin,
          deliveryAddress: needAddress
            ? {
                line1: delivery_line1,
                line2: delivery_line2,
                city: delivery_city,
                postcode: delivery_postcode
              }
            : null
        });

        res.redirect("/profile");
      }
    })
  )
);

export default app;

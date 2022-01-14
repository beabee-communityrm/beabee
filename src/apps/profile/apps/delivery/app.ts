import express from "express";

import { hasSchema, isLoggedIn } from "@core/middleware";
import { hasUser, wrapAsync } from "@core/utils";

import MembersService from "@core/services/MembersService";

import { updateSchema } from "./schemas.json";

const app = express();

app.set("views", __dirname + "/views");

app.use(isLoggedIn);

app.get("/", function (req, res) {
  res.render("index", { user: req.user });
});

app.post(
  "/",
  hasSchema(updateSchema).orFlash,
  wrapAsync(
    hasUser(async function (req, res) {
      const {
        body: {
          delivery_optin,
          delivery_line1,
          delivery_line2,
          delivery_city,
          delivery_postcode
        }
      } = req;

      await MembersService.updateMemberProfile(req.user, {
        deliveryOptIn: delivery_optin,
        deliveryAddress: delivery_optin
          ? {
              line1: delivery_line1,
              line2: delivery_line2,
              city: delivery_city,
              postcode: delivery_postcode
            }
          : null
      });

      req.flash("success", "delivery-updated");
      res.redirect("/profile/delivery");
    })
  )
);

export default app;

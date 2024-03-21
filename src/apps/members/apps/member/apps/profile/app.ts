import express from "express";

import { hasSchema } from "#core/middleware";
import { wrapAsync } from "#core/utils";

import ContactsService from "#core/services/ContactsService";

import Contact from "#models/Contact";

import { updateProfileSchema } from "./schemas.json";
import DuplicateEmailError from "#api/errors/DuplicateEmailError";

const app = express();

app.set("views", __dirname + "/views");

app.get("/", (req, res) => {
  res.render("index", { member: req.model });
});

app.post(
  "/",
  [hasSchema(updateProfileSchema).orFlash],
  wrapAsync(async (req, res) => {
    const {
      body: {
        email,
        firstname,
        lastname,
        delivery_optin,
        delivery_line1,
        delivery_line2,
        delivery_city,
        delivery_postcode
      }
    } = req;
    const contact = req.model as Contact;

    try {
      await ContactsService.updateContact(contact, {
        email,
        firstname,
        lastname
      });
      await ContactsService.updateContactProfile(contact, {
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
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        req.flash("danger", "email-duplicate");
      } else {
        throw error;
      }
    }

    res.redirect(req.originalUrl);
  })
);

export default app;

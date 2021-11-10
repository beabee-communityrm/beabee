import express from "express";

import { hasSchema, isLoggedIn } from "@core/middleware";
import { hasUser, wrapAsync } from "@core/utils";

import MembersService from "@core/services/MembersService";

import { updateSchema } from "./schemas.json";
import DuplicateEmailError from "@api/errors/DuplicateEmailError";

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
        body: { email, firstname, lastname }
      } = req;

      try {
        await MembersService.updateMember(req.user, {
          email,
          firstname,
          lastname
        });

        req.flash("success", "account-updated");
      } catch (error) {
        if (error instanceof DuplicateEmailError) {
          req.flash("danger", "email-duplicate");
        } else {
          throw error;
        }
      }

      res.redirect("/profile/account");
    })
  )
);

export default app;

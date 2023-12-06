import { RoleTypes, RoleType } from "@beabee/beabee-common";
import express from "express";
import passport from "passport";

import { getRepository } from "@core/database";
import { isValidNextUrl, getNextParam, wrapAsync } from "@core/utils";
import { loginAndRedirect } from "@core/utils/contact";

import ContactsService from "@core/services/ContactsService";

import ContactRole from "@models/ContactRole";

import config from "@config";

const app = express();

app.set("views", __dirname + "/views");

app.get("/", function (req, res) {
  const nextParam = req.query.next as string;
  if (req.user) {
    res.redirect(isValidNextUrl(nextParam) ? nextParam : "/");
  } else {
    res.render("index", { nextParam: getNextParam(nextParam) });
  }
});

if (config.dev) {
  app.get(
    "/as/:id",
    wrapAsync(async (req, res) => {
      let contact;
      if (RoleTypes.indexOf(req.params.id as RoleType) > -1) {
        const role = await getRepository(ContactRole).findOne({
          where: {
            type: req.params.id as RoleType
          },
          relations: ["contact"]
        });
        contact = role?.contact;
      } else {
        contact = await ContactsService.findOneBy({ id: req.params.id });
      }

      if (contact) {
        loginAndRedirect(req, res, contact);
      } else {
        res.redirect("/login");
      }
    })
  );
}

app.get(
  "/:code",
  wrapAsync(async function (req, res) {
    const nextParam = req.query.next as string;
    const contact = await ContactsService.findByLoginOverride(req.params.code);
    if (contact) {
      await ContactsService.updateContact(contact, { loginOverride: null });
      loginAndRedirect(
        req,
        res,
        contact,
        isValidNextUrl(nextParam) ? nextParam : "/"
      );
    } else {
      req.flash("error", "login-code-invalid");
      res.redirect("/login");
    }
  })
);

app.post("/", (req, res) => {
  const nextParam = req.query.next as string;
  passport.authenticate("local", {
    failureRedirect: "/login" + getNextParam(nextParam),
    failureFlash: true
  })(req, res, () => {
    req.session.method = "plain";
    res.redirect(isValidNextUrl(nextParam) ? nextParam : "/");
  });
});

export default app;

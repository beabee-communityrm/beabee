import { RoleTypes, RoleType } from "@beabee/beabee-common";
import express from "express";
import passport from "passport";
import { getRepository } from "typeorm";

import { isValidNextUrl, getNextParam, wrapAsync } from "@core/utils";
import { loginAndRedirect } from "@core/utils/contact";

import EmailService from "@core/services/EmailService";
import ContactsService from "@core/services/ContactsService";

import ContactRole from "@models/ContactRole";
import LoginOverrideFlow from "@models/LoginOverrideFlow";

import config from "@config";

const app = express();

app.set("views", __dirname + "/views");

app.get("/", function (req, res) {
  const nextParam = req.query.next?.toString() || "";
  if (req.user) {
    res.redirect(isValidNextUrl(nextParam) ? nextParam : "/");
  } else {
    res.render("index", { nextParam: getNextParam(nextParam) });
  }
});

app.post("/", (req, res) => {
  const nextParam = req.query.next?.toString() || "";
  passport.authenticate("local", {
    failureRedirect: "/login" + getNextParam(nextParam),
    failureFlash: true
  })(req, res, () => {
    req.session.method = "plain";
    res.redirect(isValidNextUrl(nextParam) ? nextParam : "/");
  });
});

app.get(
  "/code/:id/:code",
  wrapAsync(async function (req, res) {
    const nextParam = req.query.next?.toString() || "";

    const loginOverride = await getRepository(LoginOverrideFlow).findOne({
      where: { id: req.params.code },
      relations: ["contact"]
    });

    if (loginOverride?.isValid && loginOverride.contact.id === req.params.id) {
      // await getRepository(LoginOverrideFlow).delete({ id: req.params.code });
      loginAndRedirect(
        req,
        res,
        loginOverride.contact,
        isValidNextUrl(nextParam) ? nextParam : "/"
      );
    } else {
      const contact = await ContactsService.findOne(req.params.id);
      if (contact) {
        // Generate a new link and email the user
        const newLoginOverride = await getRepository(LoginOverrideFlow).save({
          contact
        });

        await EmailService.sendTemplateToContact(
          "login-override-resend",
          contact,
          {
            loginOverrideLink: `${config.audience}/login/code/${contact.id}/${
              newLoginOverride.id
            }${getNextParam(nextParam)}`
          }
        );
        res.render("resend");
      } else {
        req.flash("error", "login-code-invalid");
        res.redirect("/login");
      }
    }
  })
);

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
        contact = await ContactsService.findOne(req.params.id);
      }

      if (contact) {
        loginAndRedirect(req, res, contact);
      } else {
        res.redirect("/login");
      }
    })
  );
}

export default app;

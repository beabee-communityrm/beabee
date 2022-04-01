import express from "express";
import passport from "passport";
import { getRepository } from "typeorm";

import { isValidNextUrl, getNextParam, wrapAsync } from "@core/utils";

import EmailService from "@core/services/EmailService";
import MembersService from "@core/services/MembersService";

import LoginOverrideFlow from "@models/LoginOverrideFlow";
import MemberPermission, {
  PermissionType,
  PermissionTypes
} from "@models/MemberPermission";

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

app.get("/expired", function (req, res) {
  res.render("expired");
});

app.get(
  "/code/:id/:code",
  wrapAsync(async function (req, res) {
    const nextParam = req.query.next as string;

    const loginOverride = await getRepository(LoginOverrideFlow).findOne({
      where: { id: req.params.code },
      relations: ["member"]
    });

    if (loginOverride?.isValid && loginOverride.member.id === req.params.id) {
      await getRepository(LoginOverrideFlow).delete({ id: req.params.code });
      MembersService.loginAndRedirect(
        req,
        res,
        loginOverride.member,
        isValidNextUrl(nextParam) ? nextParam : "/"
      );
    } else {
      const member = await MembersService.findOne(req.params.id);
      if (member) {
        // Generate a new link and email the user
        const newLoginOverride = await getRepository(LoginOverrideFlow).save({
          member
        });

        await EmailService.sendTemplateToMember(
          "login-override-resend",
          member,
          {
            loginOverrideLink: `${config.audience}/login/code/${member.id}/${newLoginOverride.id}?next=${nextParam}`
          }
        );
        res.redirect("/login/expired");
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
      let member;
      if (PermissionTypes.indexOf(req.params.id as PermissionType) > -1) {
        const permission = await getRepository(MemberPermission).findOne({
          where: {
            permission: req.params.id as PermissionType
          },
          relations: ["member"]
        });
        member = permission?.member;
      } else {
        member = await MembersService.findOne(req.params.id);
      }

      if (member) {
        MembersService.loginAndRedirect(req, res, member);
      } else {
        res.redirect("/login");
      }
    })
  );
}

export default app;

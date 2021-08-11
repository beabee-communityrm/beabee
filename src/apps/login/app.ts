import express from "express";
import passport from "passport";
import { getRepository } from "typeorm";

import { isValidNextUrl, getNextParam, wrapAsync } from "@core/utils";

import MembersService from "@core/services/MembersService";

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

app.get(
  "/:code",
  wrapAsync(async function (req, res) {
    const nextParam = req.query.next as string;
    const member = await MembersService.findByLoginOverride(req.params.code);
    if (member) {
      await MembersService.updateMember(member, { loginOverride: undefined });
      MembersService.loginAndRedirect(
        req,
        res,
        member,
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

import express from "express";

import { hasSchema, isNotLoggedIn } from "@core/middleware";
import { cleanEmailAddress, wrapAsync } from "@core/utils";
import { generatePassword } from "@core/utils/auth";

import MembersService from "@core/services/MembersService";
import OptionsService from "@core/services/OptionsService";

import { getResetCodeSchema, resetPasswordSchema } from "./schemas.json";
import ResetPasswordFlow from "@models/ResetPasswordFlow";
import { getRepository } from "typeorm";
import EmailService from "@core/services/EmailService";
import config from "@config";

const app = express();

app.set("views", __dirname + "/views");

app.use(isNotLoggedIn);

app.get("/", function (req, res) {
  res.render("index");
});

app.post(
  "/",
  hasSchema(getResetCodeSchema).orFlash,
  wrapAsync(async function (req, res) {
    const member = await MembersService.findOne({ email: req.body.email });
    if (member) {
      const rpFlow = await getRepository(ResetPasswordFlow).save({ member });
      await EmailService.sendTemplateToMember("reset-password", member, {
        rpLink: config.audience + "/password-reset/code/" + rpFlow.id
      });
    }

    const passwordResetMessage =
      OptionsService.getText("flash-password-reset") || "";
    req.flash("info", passwordResetMessage.replace("%", req.body.email));

    res.redirect(app.mountpath as string);
  })
);

app.get("/code", function (req, res) {
  res.render("change-password");
});

app.get("/code/:password_reset_code", function (req, res) {
  res.render("change-password", {
    password_reset_code: req.params.password_reset_code
  });
});

app.post(
  "/code/:password_reset_code?",
  hasSchema(resetPasswordSchema).orFlash,
  wrapAsync(async function (req, res) {
    const rpFlow = await getRepository(ResetPasswordFlow).findOne({
      where: { id: req.body.password_reset_code },
      relations: ["member"]
    });
    if (rpFlow) {
      await MembersService.updateMember(rpFlow.member, {
        password: await generatePassword(req.body.password)
      });
      await getRepository(ResetPasswordFlow).delete(rpFlow.id);

      req.flash("success", "password-changed");
      MembersService.loginAndRedirect(req, res, rpFlow.member);
    } else {
      req.flash("warning", "password-reset-code-err");
      res.redirect(app.mountpath as string);
    }
  })
);

export default app;

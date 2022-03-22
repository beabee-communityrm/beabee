import express from "express";

import { hasSchema, isLoggedIn } from "@core/middleware";
import { hasUser, wrapAsync } from "@core/utils";
import { hashPassword, generatePassword } from "@core/utils/auth";

import MembersService from "@core/services/MembersService";

import { changePasswordSchema } from "./schemas.json";

const app = express();

app.set("views", __dirname + "/views");

app.use(isLoggedIn);

app.get("/", function (req, res) {
  res.render("index", { hasPassword: !!req.user?.password.hash });
});

app.post(
  "/",
  hasSchema(changePasswordSchema).orFlash,
  wrapAsync(
    hasUser(async function (req, res) {
      const { body, user } = req;

      if (req.user.password.hash) {
        const hash = await hashPassword(
          body.current,
          user.password.salt,
          user.password.iterations
        );

        if (hash != user.password.hash) {
          req.flash("danger", "password-invalid");
          res.redirect("/profile/change-password");
          return;
        }
      }

      await MembersService.updateMember(user, {
        password: await generatePassword(body.new)
      });

      req.flash("success", "password-changed");
      res.redirect("/profile/change-password");
    })
  )
);

export default app;

import express from "express";
import passport from "passport";

import { isValidNextUrl, getNextParam, hasUser } from "@core/utils";

const app = express();

app.set("views", __dirname + "/views");

app.get(
  "/",
  hasUser(function (req, res) {
    if (!req.user.otp.activated) {
      req.flash("warning", "2fa-unnecessary");
      res.redirect("/profile/2fa");
    } else if (req.user.otp.activated && req.session.method === "totp") {
      req.flash("warning", "2fa-already-complete");
      res.redirect("/profile");
    } else {
      res.render("index");
    }
  })
);

app.post("/", function (req, res) {
  const nextParam = req.query.next as string;
  passport.authenticate("totp", {
    failureRedirect: "/otp" + getNextParam(nextParam),
    failureFlash: "2fa-invalid"
  })(req, res, () => {
    req.session.method = "totp";
    res.redirect(isValidNextUrl(nextParam) ? nextParam : "/");
  });
});

app.get("/cancel", function (req, res) {
  res.redirect("/logout");
});

export default app;

import express from "express";

import OptionsService from "@core/services/OptionsService";
import { isNotLoggedIn } from "@core/middleware";

const app = express();

app.set("views", __dirname + "/views");

app.get("/", (req, res, next) => {
  const redirectUrl = OptionsService.getText("home-redirect-url");
  if (redirectUrl) {
    res.redirect(redirectUrl);
  } else {
    next();
  }
});

app.get("/", isNotLoggedIn, function (req, res) {
  res.render("index");
});

export default app;

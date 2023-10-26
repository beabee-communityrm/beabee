import express from "express";

import { hasUser } from "@core/utils";

const app = express();

app.set("views", __dirname + "/views");

app.get(
  "/",
  hasUser(function (req, res) {
    res.render("index");
  })
);

app.get("/cancel", function (req, res) {
  res.redirect("/logout");
});

export default app;

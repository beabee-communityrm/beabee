import { wrapAsync } from "#core/utils";
import express from "express";

const app = express();

app.get(
  "/",
  wrapAsync(async function (req, res) {
    delete req.session.method;
    await new Promise<void>((resolve) => req.logout(resolve));
    req.flash("success", "logged-out");
    res.redirect("/");
  })
);

export default app;

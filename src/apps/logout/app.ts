import express from "express";

const app = express();

app.get("/", function (req, res) {
  delete req.session.method;
  req.logout();
  req.flash("success", "logged-out");
  res.redirect("/");
});

export default app;

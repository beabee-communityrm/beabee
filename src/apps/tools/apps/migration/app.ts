import express from "express";

import { isAdmin } from "@core/middleware";

const app = express();

app.set("views", __dirname + "/views");

app.use(isAdmin);

app.get("/", (req, res) => {
  res.render("index");
});

export default app;

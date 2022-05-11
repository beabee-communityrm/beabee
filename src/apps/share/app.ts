import express from "express";
import { wrapAsync } from "@core/utils";

const app = express();

app.set("views", __dirname + "/views");

app.get(
  "/",
  wrapAsync(async (req, res) => {
    res.render("index");
  })
);

export default app;

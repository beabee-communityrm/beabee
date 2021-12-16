import express from "express";
import { getRepository } from "typeorm";

import { isAdmin } from "@core/middleware";
import { wrapAsync } from "@core/utils";

import Content, { ContentId } from "@models/Content";
import OptionsService from "@core/services/OptionsService";

const app = express();

app.set("views", __dirname + "/views");

app.use(isAdmin);

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const content = await getRepository(Content).find();
    function get(id: ContentId) {
      return content.find((c) => c.id === id)?.data || {};
    }
    res.render("index", {
      join: get("join"),
      joinSetup: get("join/setup"),
      profile: get("profile")
    });
  })
);

const parseData = {
  join: (d: any) => ({
    ...d,
    initialAmount: Number(d.initialAmount),
    periods: d.periods.map((p: { name: string; presetAmounts: string }) => ({
      name: p.name,
      presetAmounts: p.presetAmounts.split(",").map((s) => Number(s.trim()))
    })),
    showNoContribution: d.showNoContribution === "true"
  }),
  "join/setup": (d: any) => ({
    ...d,
    showMailOptIn: d.showMailOptIn === "true",
    showNewsletterOptIn: d.showNewsletterOptIn === "true"
  }),
  profile: (d: any) => d
} as const;

app.post(
  "/",
  wrapAsync(async (req, res) => {
    if (req.body.id) {
      const id = req.body.id as ContentId;
      await getRepository(Content).save({
        id,
        data: parseData[id](req.body.data)
      });
    }

    if (req.body.options) {
      await OptionsService.set(req.body.options);
    }

    res.redirect("/settings/content");
  })
);

export default app;

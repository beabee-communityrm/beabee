import express from "express";
import _ from "lodash";

import { getRepository } from "#core/database";
import { hasNewModel, hasSchema, isAdmin } from "#core/middleware";
import { wrapAsync } from "#core/utils";

import ReferralGift from "#models/ReferralGift";

import { updateSchema } from "./schemas.json";

const app = express();

app.set("views", __dirname + "/views");

app.use(isAdmin);

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const gifts = await getRepository(ReferralGift).find();
    res.render("index", { gifts });
  })
);

app.get("/gifts/:name", hasNewModel(ReferralGift, "name"), (req, res) => {
  res.render("gift", { gift: req.model });
});

interface UpdateGiftSchema {
  action: "update-gift";
  label: string;
  description: string;
  minAmount: number;
  enabled?: boolean;
}

interface UpdateOptionsSchema {
  action: "update-options";
  optionNames: string[];
  optionValues: string[];
}

interface UpdateStockSchema {
  action: "update-stock";
  stockRefs: string[];
  stockCounts: number[];
}

interface DeleteGiftSchema {
  action: "delete-gift";
}

type UpdateSchema =
  | UpdateGiftSchema
  | UpdateOptionsSchema
  | UpdateStockSchema
  | DeleteGiftSchema;

app.post(
  "/gifts/:name",
  [hasSchema(updateSchema).orFlash, hasNewModel(ReferralGift, "name")],
  wrapAsync(async (req, res) => {
    const gift = req.model as ReferralGift;
    const giftRepository = getRepository(ReferralGift);
    const data = req.body as UpdateSchema;

    switch (data.action) {
      case "update-gift":
        await giftRepository.update(gift.name, {
          label: data.label,
          description: data.description,
          minAmount: data.minAmount,
          enabled: !!data.enabled
        });
        req.flash("success", "referral-gifts-updated");
        break;
      case "update-options": {
        const options = _.zip(data.optionNames, data.optionValues)
          .map(([name, values]) => ({
            name: name!,
            values: values ? values.split(",").map((s) => s.trim()) : []
          }))
          .filter(({ name }) => !!name);
        await giftRepository.update(gift.name, { options });
        req.flash("success", "referral-gifts-options-updated");
        break;
      }
      case "update-stock": {
        const stock = new Map(
          _.zip(data.stockRefs, data.stockCounts.map(Number))
        );
        await giftRepository.update(gift.name, { stock });
        req.flash("success", "referral-gifts-stock-updated");
        break;
      }
      case "delete-gift":
        await giftRepository.delete(gift.name);
        req.flash("success", "referral-gifts-deleted");
        break;
    }

    res.redirect(
      data.action === "delete-gift" ? "/tools/referrals" : req.originalUrl
    );
  })
);

export default app;

import express from "express";
import { createQueryBuilder, getRepository } from "typeorm";

import { wrapAsync } from "@core/utils";

import ExportTypes from "@apps/tools/apps/exports/exports";

import ExportItem from "@models/ExportItem";
import Member from "@models/Member";

const app = express();

app.set("views", __dirname + "/views");

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const member = req.model as Member;
    const exportItems = await createQueryBuilder(ExportItem, "ei")
      .where("ei.itemId = :itemId", { itemId: member.id })
      .leftJoinAndSelect("ei.export", "e")
      .orderBy("e.date")
      .getMany();

    const exportItemsWithTypes = exportItems
      .filter((item) => !!ExportTypes[item.export.type])
      .map((item) => ({
        ...item,
        type: new ExportTypes[item.export.type]()
      }));

    res.render("index", { exportItems: exportItemsWithTypes, member });
  })
);

app.post(
  "/",
  wrapAsync(async (req, res) => {
    if (req.body.action === "update") {
      console.log(req.body);
      await getRepository(ExportItem).update(req.body.exportItemId, {
        status: req.body.status
      });
      req.flash("success", "exports-updated");
    }

    res.redirect(req.originalUrl);
  })
);

export default app;

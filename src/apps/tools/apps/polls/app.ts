import express from "express";
import moment from "moment";
import { createQueryBuilder } from "typeorm";

import { getRepository } from "#core/database";
import { hasNewModel, isAdmin } from "#core/middleware";
import { wrapAsync } from "#core/utils";

import Callout from "#models/Callout";
import CalloutResponse from "#models/CalloutResponse";

const app = express();

app.set("views", __dirname + "/views");

app.use(isAdmin);

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const polls = await createQueryBuilder(Callout, "p")
      .loadRelationCountAndMap("p.responseCount", "p.responses")
      .orderBy({ date: "DESC" })
      .getMany();

    res.render("index", { polls });
  })
);

app.get(
  "/:slug",
  hasNewModel(Callout, "slug"),
  wrapAsync(async (req, res) => {
    const poll = req.model as Callout;
    const responsesCount = await getRepository(CalloutResponse).count({
      where: { calloutId: poll.id }
    });
    res.render("poll", { poll, responsesCount });
  })
);

app.post(
  "/:slug",
  hasNewModel(Callout, "slug"),
  wrapAsync(async (req, res) => {
    const callout = req.model as Callout;

    switch (req.body.action) {
      case "update":
        await getRepository(Callout).update(callout.id, {
          pollMergeField: req.body.pollMergeField,
          mcMergeField: req.body.mcMergeField
        });
        req.flash("success", "polls-updated");
        res.redirect(req.originalUrl);
        break;

      case "delete-responses":
        await getRepository(CalloutResponse).delete({
          calloutId: callout.id
        });
        req.flash("success", "polls-responses-deleted");
        res.redirect("/tools/polls/" + callout.slug);
        break;
    }
  })
);

export default app;

import express from "express";
import moment from "moment";
import Papa from "papaparse";
import { createQueryBuilder, getRepository } from "typeorm";

import { hasNewModel, hasSchema, isAdmin } from "@core/middleware";
import { createDateTime, wrapAsync } from "@core/utils";
import { convertAnswers } from "@core/utils/polls";

import Callout, { CalloutAccess } from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";

import { createPollSchema } from "./schemas.json";

interface CreatePollSchema {
  title: string;
  slug: string;
  excerpt: string;
  image: string;
  closed?: boolean;
  mcMergeField?: string;
  pollMergeField?: string;
  allowUpdate?: boolean;
  allowMultiple?: boolean;
  startsDate?: string;
  startsTime?: string;
  expiresDate?: string;
  expiresTime?: string;
  access: CalloutAccess;
  hidden?: boolean;
}

function schemaToPoll(data: CreatePollSchema): Callout {
  const poll = new Callout();
  poll.title = data.title;
  poll.slug = data.slug;
  poll.excerpt = data.excerpt;
  poll.image = data.image;
  poll.mcMergeField = data.mcMergeField || null;
  poll.pollMergeField = data.pollMergeField || null;
  poll.allowUpdate = !!data.allowUpdate;
  poll.allowMultiple = !!data.allowMultiple;
  poll.access = data.access;
  poll.hidden = !!data.hidden;
  poll.starts = createDateTime(data.startsDate, data.startsTime);
  poll.expires = createDateTime(data.expiresDate, data.expiresTime);

  return poll;
}

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

app.post(
  "/",
  hasSchema(createPollSchema).orFlash,
  wrapAsync(async (req, res) => {
    const poll = await getRepository(Callout).save({
      ...schemaToPoll(req.body),
      intro: "",
      thanksText: "",
      thanksTitle: "",
      thanksRedirect: ""
    });
    req.flash("success", "polls-created");
    res.redirect("/tools/polls/" + poll.slug);
  })
);

app.get(
  "/:slug",
  hasNewModel(Callout, "slug"),
  wrapAsync(async (req, res) => {
    const responsesCount = await getRepository(CalloutResponse).count({
      where: { poll: req.model }
    });
    res.render("poll", { poll: req.model, responsesCount });
  })
);

app.get(
  "/:slug/responses",
  hasNewModel(Callout, "slug"),
  wrapAsync(async (req, res, next) => {
    const poll = req.model as Callout;
    if (poll.responsePassword && req.query.password !== poll.responsePassword) {
      req.flash("error", "polls-responses-password-protected");
      next("route");
    } else {
      const responses = await getRepository(CalloutResponse).find({
        where: { poll: req.model },
        order: {
          createdAt: "ASC"
        },
        relations: ["member"]
      });
      const responsesWithText = responses.map((response) => ({
        ...response,
        updatedAtText: moment.utc(response.updatedAt).format("HH:mm DD/MM/YYYY")
      }));
      res.render("responses", {
        poll: req.model,
        responses: responsesWithText
      });
    }
  })
);

app.post(
  "/:slug",
  hasNewModel(Callout, "slug"),
  wrapAsync(async (req, res) => {
    const poll = req.model as Callout;

    switch (req.body.action) {
      case "update":
        await getRepository(Callout).update(poll.slug, schemaToPoll(req.body));
        req.flash("success", "polls-updated");
        res.redirect(req.originalUrl);
        break;

      case "edit-form": {
        await getRepository(Callout).update(poll.slug, {
          formSchema: JSON.parse(req.body.formSchema),
          intro: req.body.intro,
          thanksText: req.body.thanksText,
          thanksTitle: req.body.thanksTitle,
          thanksRedirect: req.body.thanksRedirect
        });
        req.flash("success", "polls-updated");
        res.redirect(req.originalUrl);
        break;
      }
      case "replicate": {
        const newPoll = getRepository(Callout).create({
          ...poll,
          date: new Date(),
          title: req.body.title,
          slug: req.body.slug,
          starts: null,
          expires: null
        });
        await getRepository(Callout).save(newPoll);
        res.redirect("/tools/polls/" + newPoll.slug);
        break;
      }
      case "delete":
        await getRepository(Callout).delete(poll.slug);
        req.flash("success", "polls-deleted");
        res.redirect("/tools/polls");
        break;
      case "export-responses": {
        if (
          poll.responsePassword &&
          req.query.password !== poll.responsePassword
        ) {
          req.flash("error", "polls-responses-password-protected");
          res.redirect(req.originalUrl);
        } else {
          const exportName = `responses-${poll.title}_${moment().format()}.csv`;
          const responses = await getRepository(CalloutResponse).find({
            where: { poll },
            order: { createdAt: "ASC" },
            relations: ["member"]
          });
          const exportData = responses.map((response) => {
            return {
              Date: response.createdAt,
              ...(response.member
                ? {
                    FirstName: response.member.firstname,
                    LastName: response.member.lastname,
                    FullName: response.member.fullname,
                    EmailAddress: response.member.email
                  }
                : {
                    FirstName: "",
                    LastName: "",
                    FullName: response.guestName,
                    EmailAddress: response.guestEmail
                  }),
              IsMember: !!response.member,
              ...convertAnswers(poll, response.answers)
            };
          });
          res.attachment(exportName).send(Papa.unparse(exportData));
        }
        break;
      }
      case "delete-responses":
        await getRepository(CalloutResponse).delete({
          poll: { slug: poll.slug }
        });
        req.flash("success", "polls-responses-deleted");
        res.redirect("/tools/polls/" + poll.slug);
        break;
    }
  })
);

export default app;

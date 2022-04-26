import express from "express";
import moment from "moment";
import Papa from "papaparse";
import { createQueryBuilder, getRepository } from "typeorm";

import { hasNewModel, hasSchema, isAdmin } from "@core/middleware";
import { createDateTime, wrapAsync } from "@core/utils";
import { convertAnswers } from "@core/utils/polls";

import Poll, { PollAccess, PollTemplate } from "@models/Poll";
import PollResponse from "@models/PollResponse";

import { createPollSchema } from "./schemas.json";

interface CreatePollSchema {
  title: string;
  slug: string;
  excerpt: string;
  image: string;
  template: PollTemplate;
  mcMergeField?: string;
  pollMergeField?: string;
  allowUpdate?: boolean;
  allowMultiple?: boolean;
  startsDate?: string;
  startsTime?: string;
  expiresDate?: string;
  expiresTime?: string;
  access: PollAccess;
  hidden?: boolean;
}

function schemaToPoll(
  data: CreatePollSchema
): Omit<Poll, "templateSchema" | "responses"> {
  const poll = new Poll();
  poll.title = data.title;
  poll.slug = data.slug;
  poll.excerpt = data.excerpt;
  poll.image = data.image;
  poll.mcMergeField = data.mcMergeField || null;
  poll.pollMergeField = data.pollMergeField || null;
  poll.template = data.template;
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
    const polls = await createQueryBuilder(Poll, "p")
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
    const poll = await getRepository(Poll).save(schemaToPoll(req.body));
    req.flash("success", "polls-created");
    res.redirect("/tools/polls/" + poll.slug);
  })
);

app.get(
  "/:slug",
  hasNewModel(Poll, "slug"),
  wrapAsync(async (req, res) => {
    const responsesCount = await getRepository(PollResponse).count({
      where: { poll: req.model }
    });
    res.render("poll", { poll: req.model, responsesCount });
  })
);

app.get(
  "/:slug/responses",
  hasNewModel(Poll, "slug"),
  wrapAsync(async (req, res, next) => {
    const poll = req.model as Poll;
    if (poll.responsePassword && req.query.password !== poll.responsePassword) {
      req.flash("error", "polls-responses-password-protected");
      next("route");
    } else {
      const responses = await getRepository(PollResponse).find({
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
  hasNewModel(Poll, "slug"),
  wrapAsync(async (req, res) => {
    const poll = req.model as Poll;

    switch (req.body.action) {
      case "update":
        await getRepository(Poll).update(poll.slug, schemaToPoll(req.body));
        req.flash("success", "polls-updated");
        res.redirect(req.originalUrl);
        break;

      case "edit-form": {
        const templateSchema = req.body.templateSchema;
        if (poll.template === "builder") {
          templateSchema.formSchema = JSON.parse(req.body.formSchema);
        }
        await getRepository(Poll).update(poll.slug, { templateSchema });
        req.flash("success", "polls-updated");
        res.redirect(req.originalUrl);
        break;
      }
      case "replicate": {
        const newPoll = getRepository(Poll).create({
          ...poll,
          date: new Date(),
          title: req.body.title,
          slug: req.body.slug,
          starts: null,
          expires: null
        });
        await getRepository(Poll).save(newPoll);
        res.redirect("/tools/polls/" + newPoll.slug);
        break;
      }
      case "delete":
        await getRepository(Poll).delete(poll.slug);
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
          const responses = await getRepository(PollResponse).find({
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
        await getRepository(PollResponse).delete({ poll: { slug: poll.slug } });
        req.flash("success", "polls-responses-deleted");
        res.redirect("/tools/polls/" + poll.slug);
        break;
    }
  })
);

export default app;

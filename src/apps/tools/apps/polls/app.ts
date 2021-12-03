import express from "express";
import moment from "moment";
import Papa from "papaparse";
import { createQueryBuilder, getRepository } from "typeorm";

import { hasNewModel, hasSchema, isAdmin } from "@core/middleware";
import { createDateTime, wrapAsync } from "@core/utils";

import Poll, { PollAccess, PollTemplate } from "@models/Poll";
import PollResponse, { PollResponseAnswer } from "@models/PollResponse";

import { createPollSchema } from "./schemas.json";

interface CreatePollSchema {
  title: string;
  slug: string;
  excerpt: string;
  image?: string;
  template: PollTemplate;
  closed?: boolean;
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
  poll.image = data.image || undefined;
  poll.closed = !!data.closed;
  poll.mcMergeField = data.mcMergeField;
  poll.pollMergeField = data.pollMergeField;
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
      .orderBy({ date: "ASC" })
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
          closed: true
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
              FullName: response.guestName,
              EmailAddress: response.guestEmail,
              ...(response.member && {
                FirstName: response.member.firstname,
                LastName: response.member.lastname,
                FullName: response.member.fullname,
                EmailAddress: response.member.email
              }),
              IsMember: !!response.member,
              ...convertAnswers(poll, response.answers)
            };
          });
          res.attachment(exportName).send(Papa.unparse(exportData));
        }
        break;
      }
    }
  })
);

interface ComponentSchema {
  key: string;
  label?: string;
  input?: boolean;
  values?: { label: string; value: string }[];
  components?: ComponentSchema[];
}

function flattenComponents(components: ComponentSchema[]): ComponentSchema[] {
  return components.flatMap((component) => [
    component,
    ...flattenComponents(component.components || [])
  ]);
}

function getNiceAnswer(component: ComponentSchema, value: string): string {
  return component.values?.find((v) => v.value === value)?.label || value;
}

function convertAnswer(
  component: ComponentSchema,
  answer: PollResponseAnswer
): string {
  console.log(component, answer);
  if (!answer) {
    return "";
  } else if (typeof answer === "object") {
    return Object.entries(answer)
      .filter(([value, selected]) => selected)
      .map(([value]) => getNiceAnswer(component, value))
      .join(", ");
  } else if (typeof answer === "string") {
    return getNiceAnswer(component, answer);
  } else {
    return answer.toString();
  }
}

export function convertAnswers(
  poll: Poll,
  answers: Record<string, unknown>
): Record<string, unknown> {
  if (poll.template !== "builder") {
    return answers;
  }

  const formSchema = poll.templateSchema.formSchema as {
    components: ComponentSchema[];
  };

  return Object.assign(
    {},
    ...flattenComponents(formSchema.components)
      .filter((component) => component.input)
      .map((component) => {
        return {
          [component.label || component.key]: convertAnswer(
            component,
            answers[component.key]
          )
        };
      })
  );
}

export default app;

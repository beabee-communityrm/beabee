import express, { NextFunction, Request, Response } from "express";
import _ from "lodash";
import { getRepository } from "typeorm";

import { hasNewModel, hasSchema, isLoggedIn } from "@core/middleware";
import { setTrackingCookie } from "@core/sessions";
import { isSocialScraper, wrapAsync } from "@core/utils";
import * as auth from "@core/utils/auth";

import MembersService from "@core/services/MembersService";
import PollsService from "@core/services/PollsService";

import Poll, { PollAccess } from "@models/Poll";
import { PollResponseAnswers } from "@models/PollResponse";

import schemas from "./schemas.json";

import config from "@config";

function getView(poll: Poll): string {
  switch (poll.template) {
    case "ballot":
      return "ballot";
    case "builder":
      return "poll";
    case "custom":
      return `polls/${poll.slug}`;
  }
}

function hasPollAnswers(req: Request, res: Response, next: NextFunction): void {
  const poll = req.model as Poll;
  const schema = (() => {
    switch (poll.template) {
      case "ballot":
        return schemas.ballotSchema;
      case "builder":
        return schemas.builderSchema;
      case "custom":
        return (schemas.customSchemas as any)[poll.slug];
    }
  })();

  hasSchema(schema).orFlash(req, res, () => {
    req.answers =
      poll.template === "builder"
        ? JSON.parse(req.body.answers)
        : req.body.answers;
    // TODO: validate answers
    next();
  });
}

const app = express();

app.set("views", __dirname + "/views");

app.get(
  "/",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const polls = await PollsService.getVisiblePollsWithResponses(req.user!);
    const [activePolls, inactivePolls] = _.partition(polls, (p) => p.active);
    res.render("index", { activePolls, inactivePolls });
  })
);

app.get(
  "/_oembed",
  wrapAsync(async (req, res, next) => {
    const url = req.query.url as string;
    if (url && url.startsWith(config.audience + "/polls/")) {
      const pollId = url
        .replace(config.audience + "/polls/", "")
        .replace(/\/embed\/?/, "");
      const poll = await getRepository(Poll).findOne(pollId);
      if (poll) {
        res.send({
          type: "rich",
          title: poll.title,
          html: `<iframe src="${config.audience}/polls/${pollId}/embed" frameborder="0" style="display: block; width: 100%"></iframe>`
        });
        return;
      }
    }

    next("route");
  })
);

// TODO: move this to the main site
app.get(
  "/campaign2019",
  wrapAsync(async (req, res, next) => {
    const poll = await getRepository(Poll).findOne({ slug: "campaign2019" });
    if (auth.loggedIn(req) === auth.AuthenticationStatus.NOT_LOGGED_IN) {
      res.render("polls/campaign2019-landing", { poll });
    } else {
      next();
    }
  })
);

app.get("/:slug", hasNewModel(Poll, "slug"), (req, res, next) => {
  if (isSocialScraper(req)) {
    res.render("share");
  } else {
    next();
  }
});

async function getUserAnswersAndClear(
  req: Request
): Promise<PollResponseAnswers> {
  const answers = req.session.answers;
  delete req.session.answers;

  return (
    answers ||
    (req.user &&
      (await PollsService.getResponse(req.model as Poll, req.user))?.answers) ||
    {}
  );
}

function pollUrl(
  poll: Poll,
  opts: { pollsCode?: string; isEmbed?: boolean }
): string {
  return [
    "/polls/" + poll.slug,
    ...(opts.pollsCode ? ["/" + opts.pollsCode] : []),
    ...(opts.isEmbed ? ["/embed"] : [])
  ].join("");
}

// :code is greedily matching /embed
function fixParams(req: Request, res: Response, next: NextFunction) {
  if (!req.params.embed && req.params.code === "embed") {
    req.params.embed = "/embed";
    req.params.code = "";
  }
  next();
}

app.get(
  "/:slug/:code?/thanks",
  hasNewModel(Poll, "slug"),
  wrapAsync(async (req, res) => {
    const poll = req.model as Poll;
    // Always fetch answers to clear session even on redirect
    const answers = await getUserAnswersAndClear(req);

    if (poll.templateSchema.thanksRedirect) {
      res.redirect(poll.templateSchema.thanksRedirect as string);
    } else {
      res.render(poll.template === "custom" ? getView(poll) : "thanks", {
        poll,
        answers,
        pollsCode: req.params.code,

        // TODO: remove this hack
        ...(poll.access === PollAccess.OnlyAnonymous && {
          isLoggedIn: false,
          menu: { main: [] }
        })
      });
    }
  })
);

app.get(
  "/:slug/:code?:embed(/embed)?",
  hasNewModel(Poll, "slug"),
  fixParams,
  wrapAsync(async (req, res, next) => {
    const poll = req.model as Poll;
    const pollsCode = req.params.code?.toUpperCase();
    const isEmbed = !!req.params.embed;
    const isPreview = req.query.preview && req.user?.hasPermission("admin");
    const isGuest = isEmbed || !(pollsCode || req.user);

    if (isEmbed) {
      res.removeHeader("X-Frame-Options");
    }

    // Anonymous polls can't be accessed with polls code
    if (poll.access === PollAccess.OnlyAnonymous && pollsCode) {
      return next("route");
    }

    // Member only polls need a member
    if (poll.access === PollAccess.Member && isGuest) {
      return res.render("login", { poll, isEmbed });
    }

    // Handle partial answers from URL
    const answers = req.query.answers as PollResponseAnswers;
    // We don't support allowMultiple polls at the moment
    if (!isEmbed && answers && !poll.allowMultiple) {
      const member = pollsCode
        ? await MembersService.findOne({ pollsCode })
        : req.user;
      if (member) {
        await PollsService.setResponse(poll, member, answers, true);
      }
      if (!req.user) {
        req.session.answers = answers;
      }
      res.redirect(pollUrl(poll, { isEmbed, pollsCode }) + "#vote");
    } else {
      res.render(getView(poll), {
        poll,
        answers: poll.allowMultiple ? {} : await getUserAnswersAndClear(req),
        isEmbed,
        isGuest,
        preview: isPreview,

        // TODO: remove this hack
        ...(poll.access === PollAccess.OnlyAnonymous && {
          isLoggedIn: false,
          menu: { main: [] }
        })
      });
    }
  })
);

app.post(
  "/:slug/:code?:embed(/embed)?",
  hasNewModel(Poll, "slug"),
  hasPollAnswers,
  fixParams,
  wrapAsync(async (req, res) => {
    const poll = req.model as Poll;
    const pollsCode = req.params.code?.toUpperCase();
    const isEmbed = !!req.params.embed;

    const member =
      isEmbed || poll.access === PollAccess.OnlyAnonymous
        ? undefined
        : pollsCode
        ? await MembersService.findOne({ pollsCode })
        : req.user;

    if (poll.access === PollAccess.Member && !member) {
      return auth.handleNotAuthed(
        auth.AuthenticationStatus.NOT_LOGGED_IN,
        req,
        res
      );
    }

    const error =
      pollsCode && !member
        ? "unknown-user"
        : member
        ? await PollsService.setResponse(poll, member, req.answers!)
        : await PollsService.setGuestResponse(
            poll,
            req.body.guestName,
            req.body.guestEmail,
            req.answers!
          );

    if (member) {
      setTrackingCookie(member.id, res);
    }

    if (error) {
      req.flash("error", "polls-" + error);
      res.redirect(pollUrl(poll, { isEmbed, pollsCode }) + "#vote");
    } else {
      if (!req.user) {
        req.session.answers = req.answers;
      }
      res.redirect(pollUrl(poll, { pollsCode }) + "/thanks");
    }
  })
);

module.exports = app;

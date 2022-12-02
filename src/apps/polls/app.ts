import express, { NextFunction, Request, Response } from "express";
import _ from "lodash";
import { getRepository } from "typeorm";

import { hasNewModel, hasSchema, isLoggedIn } from "@core/middleware";
import { setTrackingCookie } from "@core/sessions";
import { escapeRegExp, isSocialScraper, wrapAsync } from "@core/utils";
import * as auth from "@core/utils/auth";

import ContactsService from "@core/services/ContactsService";
import CalloutsService from "@core/services/CalloutsService";

import Callout, { CalloutAccess } from "@models/Callout";
import { CalloutResponseAnswers } from "@models/CalloutResponse";

import schemas from "./schemas.json";

import config from "@config";

function hasPollAnswers(req: Request, res: Response, next: NextFunction): void {
  hasSchema(schemas.builderSchema).orFlash(req, res, () => {
    req.answers = JSON.parse(req.body.answers);
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
    const polls = await CalloutsService.getVisibleCalloutsWithResponses(
      req.user!
    );
    const [activePolls, inactivePolls] = _.partition(polls, (p) => p.active);
    res.render("index", { activePolls, inactivePolls });
  })
);

app.get(
  "/_oembed",
  wrapAsync(async (req, res, next) => {
    const url = req.query.url as string | undefined;
    const pathMatch = new RegExp(
      `^${escapeRegExp(config.audience)}/(polls|callouts)/`
    );
    if (url && pathMatch.test(url)) {
      const pollId = url.replace(pathMatch, "").replace(/\/embed\/?/, "");
      const poll = await getRepository(Callout).findOne(pollId);
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
    const poll = await getRepository(Callout).findOne({ slug: "campaign2019" });
    if (auth.loggedIn(req) === auth.AuthenticationStatus.NOT_LOGGED_IN) {
      res.render("polls/campaign2019-landing", { poll });
    } else {
      next();
    }
  })
);

app.get("/:slug", hasNewModel(Callout, "slug"), (req, res, next) => {
  if (isSocialScraper(req)) {
    res.render("share");
  } else {
    next();
  }
});

async function getUserAnswersAndClear(
  req: Request
): Promise<CalloutResponseAnswers> {
  const answers = req.session.answers;
  delete req.session.answers;

  return (
    answers ||
    (req.user &&
      (await CalloutsService.getResponse(req.model as Callout, req.user))
        ?.answers) ||
    {}
  );
}

function pollUrl(
  poll: Callout,
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
  hasNewModel(Callout, "slug"),
  wrapAsync(async (req, res) => {
    const poll = req.model as Callout;
    // Always fetch answers to clear session even on redirect
    const answers = await getUserAnswersAndClear(req);

    if (poll.thanksRedirect) {
      res.redirect(poll.thanksRedirect);
    } else {
      res.render("thanks", {
        poll,
        answers,
        pollsCode: req.params.code,

        // TODO: remove this hack
        ...(poll.access === CalloutAccess.OnlyAnonymous && {
          isLoggedIn: false,
          menu: { main: [] }
        })
      });
    }
  })
);

app.get(
  "/:slug/:code?:embed(/embed)?",
  hasNewModel(Callout, "slug"),
  fixParams,
  wrapAsync(async (req, res, next) => {
    const poll = req.model as Callout;
    const pollsCode = req.params.code?.toUpperCase();
    const isEmbed = !!req.params.embed;
    const isPreview = req.query.preview && req.user?.hasPermission("admin");
    const isGuest = isEmbed || !(pollsCode || req.user);

    if (isEmbed) {
      res.removeHeader("X-Frame-Options");
    }

    // Anonymous polls can't be accessed with polls code
    if (poll.access === CalloutAccess.OnlyAnonymous && pollsCode) {
      return next("route");
    }

    // Member only polls need a member
    if (poll.access === CalloutAccess.Member && isGuest) {
      return res.render("login", { poll, isEmbed });
    }

    // Handle partial answers from URL
    const answers = req.query.answers as CalloutResponseAnswers;
    // We don't support allowMultiple polls at the moment
    if (!isEmbed && answers && !poll.allowMultiple) {
      const member = pollsCode
        ? await ContactsService.findOne({ pollsCode })
        : req.user;
      if (member) {
        await CalloutsService.setResponse(poll, member, answers, true);
      }
      if (!req.user) {
        req.session.answers = answers;
      }
      res.redirect(pollUrl(poll, { isEmbed, pollsCode }) + "#vote");
    } else {
      res.render("poll", {
        poll,
        answers: poll.allowMultiple ? {} : await getUserAnswersAndClear(req),
        isEmbed,
        isGuest,
        preview: isPreview,

        // TODO: remove this hack
        ...(poll.access === CalloutAccess.OnlyAnonymous && {
          isLoggedIn: false,
          menu: { main: [] }
        })
      });
    }
  })
);

app.post(
  "/:slug/:code?:embed(/embed)?",
  hasNewModel(Callout, "slug"),
  hasPollAnswers,
  fixParams,
  wrapAsync(async (req, res) => {
    const poll = req.model as Callout;
    const pollsCode = req.params.code?.toUpperCase();
    const isEmbed = !!req.params.embed;

    const member =
      isEmbed || poll.access === CalloutAccess.OnlyAnonymous
        ? undefined
        : pollsCode
        ? await ContactsService.findOne({ pollsCode })
        : req.user;

    if (poll.access === CalloutAccess.Member && !member) {
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
        ? await CalloutsService.setResponse(poll, member, req.answers!)
        : await CalloutsService.setGuestResponse(
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

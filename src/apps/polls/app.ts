import { CalloutResponseAnswers } from "@beabee/beabee-common";
import express, { NextFunction, Request, Response } from "express";
import _ from "lodash";
import { getRepository } from "typeorm";

import { hasNewModel, hasSchema, isLoggedIn } from "@core/middleware";
import { setTrackingCookie } from "@core/sessions";
import { escapeRegExp, isSocialScraper, wrapAsync } from "@core/utils";
import * as auth from "@core/utils/auth";

import ContactsService from "@core/services/ContactsService";
import CalloutsService from "@core/services/CalloutsService";

import InvalidCalloutResponse from "@api/errors/InvalidCalloutResponse";

import Callout, { CalloutAccess } from "@models/Callout";

import schemas from "./schemas.json";

import config from "@config";

function hasCalloutAnswers(
  req: Request,
  res: Response,
  next: NextFunction
): void {
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
    const callouts = await CalloutsService.getVisibleCalloutsWithResponses(
      req.user!
    );
    const [activePolls, inactivePolls] = _.partition(callouts, (p) => p.active);
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
      const calloutId = url.replace(pathMatch, "").replace(/\/embed\/?/, "");
      const callout = await getRepository(Callout).findOne(calloutId);
      if (callout) {
        res.send({
          type: "rich",
          title: callout.title,
          html: `<iframe src="${config.audience}/polls/${calloutId}/embed" frameborder="0" style="display: block; width: 100%"></iframe>`
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

function calloutUrl(
  callout: Callout,
  opts: { pollsCode?: string; isEmbed?: boolean }
): string {
  return [
    "/polls/" + callout.slug,
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
    const callout = req.model as Callout;
    // Always fetch answers to clear session even on redirect
    const answers = await getUserAnswersAndClear(req);

    if (callout.thanksRedirect) {
      res.redirect(callout.thanksRedirect);
    } else {
      res.render("thanks", {
        poll: callout,
        answers,
        pollsCode: req.params.code,

        // TODO: remove this hack
        ...(callout.access === CalloutAccess.OnlyAnonymous && {
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
    const callout = req.model as Callout;
    const pollsCode = req.params.code?.toUpperCase();
    const isEmbed = !!req.params.embed;
    const isPreview = req.query.preview && req.user?.hasRole("admin");
    const isGuest = isEmbed || !(pollsCode || req.user);

    if (isEmbed) {
      res.removeHeader("X-Frame-Options");
    }

    // Anonymous callouts can't be accessed with polls code
    if (callout.access === CalloutAccess.OnlyAnonymous && pollsCode) {
      return next("route");
    }

    // Member only callouts need a member
    if (callout.access === CalloutAccess.Member && isGuest) {
      return res.render("login", { poll: callout, isEmbed });
    }

    // Handle partial answers from URL
    const answers = req.query.answers as CalloutResponseAnswers;
    // We don't support allowMultiple callouts at the moment
    if (!isEmbed && answers && !callout.allowMultiple) {
      const contact = pollsCode
        ? await ContactsService.findOne({ pollsCode })
        : req.user;
      if (contact) {
        await CalloutsService.setResponse(callout, contact, answers, true);
      }
      if (!req.user) {
        req.session.answers = answers;
      }
      res.redirect(calloutUrl(callout, { isEmbed, pollsCode }) + "#vote");
    } else {
      res.render("poll", {
        poll: callout,
        answers: callout.allowMultiple ? {} : await getUserAnswersAndClear(req),
        isEmbed,
        isGuest,
        preview: isPreview,

        // TODO: remove this hack
        ...(callout.access === CalloutAccess.OnlyAnonymous && {
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
  hasCalloutAnswers,
  fixParams,
  wrapAsync(async (req, res) => {
    const callout = req.model as Callout;
    const pollsCode = req.params.code?.toUpperCase();
    const isEmbed = !!req.params.embed;

    const contact =
      isEmbed || callout.access === CalloutAccess.OnlyAnonymous
        ? undefined
        : pollsCode
          ? await ContactsService.findOne({ pollsCode })
          : req.user;

    if (callout.access === CalloutAccess.Member && !contact) {
      return auth.handleNotAuthed(
        auth.AuthenticationStatus.NOT_LOGGED_IN,
        req,
        res
      );
    }

    try {
      if (pollsCode && !contact) {
        throw new InvalidCalloutResponse("unknown-user");
      }

      if (contact) {
        await CalloutsService.setResponse(callout, contact, req.answers!);
      } else {
        await CalloutsService.setGuestResponse(
          callout,
          req.body.guestName,
          req.body.guestEmail,
          req.answers!
        );
      }

      if (contact) {
        setTrackingCookie(contact.id, res);
      }

      if (!req.user) {
        req.session.answers = req.answers;
      }
      res.redirect(calloutUrl(callout, { pollsCode }) + "/thanks");
    } catch (err) {
      if (err instanceof InvalidCalloutResponse) {
        req.flash("error", "polls-" + err.subCode);
        res.redirect(calloutUrl(callout, { isEmbed, pollsCode }) + "#vote");
      }
    }
  })
);

module.exports = app;

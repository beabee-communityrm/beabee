import "module-alias/register";

import cleanDeep from "clean-deep";
import cookie from "cookie-parser";
import csrf from "csurf"; // TODO: This package is deprecated, see https://www.npmjs.com/package/csurf
import express, { ErrorRequestHandler } from "express";
import flash from "express-flash";
import helmet from "helmet";

import appLoader from "@core/app-loader";
import { log, requestErrorLogger, requestLogger } from "@core/logging";
import quickflash from "@core/quickflash";
import { initApp, startServer } from "@core/server";
import sessions from "@core/sessions";
import { isInvalidType } from "@core/utils";

import OptionsService, { OptionKey } from "@core/services/OptionsService";
import PageSettingsService from "@core/services/PageSettingsService";

//import specialUrlHandler from '@apps/tools/apps/special-urls/handler';

import config from "@config";

if (!config.gocardless.sandbox && config.dev) {
  log.error(
    "Dev mode enabled but GoCardless is not in sandbox, refusing to start"
  );
  process.exit(1);
}

const app = express();

app.set("views", __dirname + "/views");
app.set("view engine", "pug");
app.set("view cache", false);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookie());
app.use(express.urlencoded({ extended: true }));

// Remove empty strings from form submissions
app.use((req, res, next) => {
  if (req.headers["content-type"] === "application/x-www-form-urlencoded") {
    req.body = cleanDeep(req.body, {
      emptyArrays: false,
      emptyObjects: false
    });
  }
  next();
});

// Setup tracker
app.use("/membership.js", (req, res) => {
  const referrerUrl = req.get("referer");
  res.set("Content-Type", "application/javascript");
  if (
    referrerUrl &&
    config.trustedOrigins.some((url) => referrerUrl.startsWith(url))
  ) {
    const memberId = req.cookies.memberId;
    if (memberId) {
      res.send('window.Membership = {memberId: "' + memberId + '"}');
    } else {
      res.send("window.Membership = {}");
    }
  } else {
    res.status(404).send("");
  }
});

app.get("/favicon.png", (req, res) => {
  res.redirect(OptionsService.getText("logo"));
});

// Log the rest
app.use(requestLogger);

initApp()
  .then(async () => {
    // Load some caches and make them immediately available
    await PageSettingsService.reload();
    app.use((req, res, next) => {
      res.locals.Options = (opt: OptionKey) => OptionsService.getText(opt);
      res.locals.Options.list = (opt: OptionKey) => OptionsService.getList(opt);
      res.locals.Options.bool = (opt: OptionKey) => OptionsService.getBool(opt);
      res.locals.pageSettings = PageSettingsService.getPath(req.path);
      next();
    });

    // Handle sessions
    sessions(app);

    // CSRF
    app.use(csrf());

    app.use(function (err, req, res, next) {
      if (err.code == "EBADCSRFTOKEN") {
        return res
          .status(403)
          .send(
            "Error: Please make sure cookies are enabled. (CSRF token invalid)"
          );
      }
      next(err);
    } as ErrorRequestHandler);

    // Include support for notifications
    app.use(flash());
    app.use(quickflash);

    // Load apps
    await appLoader(app);

    // Hook to handle special URLs
    //app.use( '/s', specialUrlHandler );

    // Ignore QueryFailedError for invalid type, probably just bad URL
    app.use(function (err, req, res, next) {
      next(isInvalidType(err) ? undefined : err);
    } as ErrorRequestHandler);

    // Error 404
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use(function (req, res, next) {
      res.status(404);
      res.render("404");
    });

    app.use(requestErrorLogger);

    // Error 500
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use(function (err, req, res, next) {
      res.status(500);
      res.render("500", { error: config.dev ? err.stack : undefined });
    } as ErrorRequestHandler);

    startServer(app);
  })
  .catch((err) => {
    log.error("Error during initialization", err);
  });

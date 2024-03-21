const express = require("express");
const _ = require("lodash");
const moment = require("moment");
const mongoose = require("mongoose");

const { SpecialUrls } = require("#core/database");
const { wrapAsync } = require("#core/utils");

const { default: EmailService } = require("#core/services/EmailService");

const actions = require("./actions");
const { getSpecialUrlUrl } = require("./utils");

const app = express();
app.set("views", __dirname + "/views");

// TODO : clean this up
app.locals.basedir = __dirname + "/../../../..";

const actionsByName = _(actions)
  .map((action) => [action.name, action])
  .fromPairs()
  .valueOf();

const hasValidSpecialUrl = wrapAsync(async (req, res, next) => {
  let specialUrl;
  try {
    specialUrl = await SpecialUrls.findOne({
      uuid: req.params.urlId
    }).populate("group");
  } catch (err) {
    if (!(err instanceof mongoose.CastError)) {
      throw err;
    }
  }

  if (!specialUrl) {
    next("route");
    return;
  }

  if (!specialUrl.group.active) {
    res.render("inactive-group");
    return;
  }

  if (specialUrl.active) {
    req.specialUrl = specialUrl;
    next();
  } else {
    const newSpecialUrl = await SpecialUrls.create({
      email: specialUrl.email,
      group: specialUrl.group,
      firstname: specialUrl.firstname,
      lastname: specialUrl.lastname,
      expires: moment.utc().add(specialUrl.group.urlDuration, "hours")
    });

    await EmailService.sendTemplateTo(
      "expired-special-url-resend",
      {
        email: specialUrl.email,
        name: specialUrl.firstname + " " + specialUrl.lastname
      },
      {
        firstName: specialUrl.firstname,
        newUrl: getSpecialUrlUrl(newSpecialUrl)
      }
    );

    res.render("resend");
  }
});

app.get("/:urlId/done", hasValidSpecialUrl, (req, res) => {
  const thanksMessage = req.specialUrl.group.thanksMessage.replace(
    "[firstname]",
    req.specialUrl.firstname
  );
  res.render("done", { thanksMessage });
});

async function processSpecialUrl(req, res) {
  const { specialUrl } = req;

  req.log.info({
    app: "special-urls",
    action: "opened",
    data: {
      specialUrl
    }
  });

  if (specialUrl.completedCount > 0) {
    res.render("already-opened", { specialUrl });
    return;
  }

  for (let action of specialUrl.group.actions) {
    req.log.info({
      app: "special-urls",
      action: "run-action",
      data: {
        specialUrl: specialUrl._id,
        action
      }
    });

    const doNextAction = await actionsByName[action.name].run(
      req,
      res,
      action.params
    );
    // Actions are expected to handle sending the user a response if they return false
    if (!doNextAction) {
      return;
    }
  }

  req.log.info({
    app: "special-urls",
    action: "completed",
    data: {
      specialUrl: specialUrl._id
    }
  });

  await specialUrl.update({ $inc: { completedCount: 1 } });

  res.redirect(`/s/${req.params.urlId}/done`);
}

app.get(
  "/:urlId",
  hasValidSpecialUrl,
  wrapAsync(async (req, res) => {
    const { specialUrl } = req;
    await specialUrl.update({ $inc: { openCount: 1 } });

    if (specialUrl.group.skipConfirm) {
      await processSpecialUrl(req, res);
    } else {
      res.render("confirm", { specialUrl });
    }
  })
);

app.post("/:urlId", hasValidSpecialUrl, wrapAsync(processSpecialUrl));

module.exports = app;

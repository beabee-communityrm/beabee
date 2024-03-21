const busboy = require("connect-busboy");
const express = require("express");
const _ = require("lodash");
const moment = require("moment");
const Papa = require("papaparse");

const { SpecialUrlGroups, SpecialUrls } = require("#core/database");
const { hasModel, hasSchema, isAdmin } = require("#core/middleware");
const { wrapAsync } = require("#core/utils");
const { loadParams, parseParams } = require("#core/utils/params");

const actions = require("./actions");
const {
  createSpecialUrlsSchema,
  updateSpecialUrlsSchema
} = require("./schemas.json");
const { getSpecialUrlUrl } = require("./utils.js");

const actionsByName = _(actions)
  .map((action) => [action.name, action])
  .fromPairs()
  .valueOf();

const app = express();

app.set("views", __dirname + "/views");

app.use(isAdmin);

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const specialUrlGroups = await SpecialUrlGroups.find();
    const actionsWithParams = await loadParams(actions);

    res.render("index", { specialUrlGroups, actionsWithParams });
  })
);

async function createSpecialUrls(data) {
  const {
    name,
    expiresDate,
    expiresTime,
    urlDuration,
    thanksMessage,
    actions: newActions
  } = data;

  return await SpecialUrlGroups.create({
    name,
    expires: expiresDate && moment.utc(`${expiresDate}T${expiresTime}`),
    urlDuration,
    thanksMessage,
    enabled: false,
    actions: await Promise.all(
      newActions.map(async (action) => ({
        name: action.name,
        params: await parseParams(actionsByName[action.name], action.params)
      }))
    )
  });
}

app.post(
  "/",
  hasSchema(createSpecialUrlsSchema).orFlash,
  wrapAsync(async (req, res) => {
    const specialUrlGroup = await createSpecialUrls(req.body);
    req.flash("success", "special-urls-created");
    res.redirect("/tools/special-urls/" + specialUrlGroup._id);
  })
);

app.get(
  "/:_id",
  hasModel(SpecialUrlGroups, "_id"),
  wrapAsync(async (req, res) => {
    const specialUrls = await SpecialUrls.find({ group: req.model });
    res.render("special-urls", { specialUrlGroup: req.model, specialUrls });
  })
);

app.post(
  "/:_id",
  [
    hasModel(SpecialUrlGroups, "_id"),
    hasSchema(updateSpecialUrlsSchema).orFlash
  ],
  wrapAsync(async (req, res) => {
    switch (req.body.action) {
      case "toggle":
        await req.model.update({ $set: { enabled: !req.model.enabled } });
        break;
      case "force-expire":
        await SpecialUrls.updateMany(
          { group: req.model },
          { $set: { expires: moment() } }
        );
        break;
      case "update":
        await req.model.update({
          $set: {
            name: req.body.name,
            thanksMessage: req.body.thanksMessage
          }
        });
        break;
      case "export-urls": {
        const exportName = `export-${
          req.model.name
        }_${new Date().toISOString()}.csv`;
        const exportData = (await SpecialUrls.find({ group: req.model }))
          .filter((specialUrl) => !req.body.onlyActive || specialUrl.active)
          .map((specialUrl) => ({
            EmailAddress: specialUrl.email,
            FirstName: specialUrl.firstname,
            LastName: specialUrl.lastname,
            Expires: specialUrl.expires,
            URL: getSpecialUrlUrl(specialUrl),
            OpenCount: specialUrl.openCount,
            CompletedCount: specialUrl.completedCount
          }));
        res.attachment(exportName).send(Papa.unparse(exportData));
        return;
      }
      case "delete":
        await SpecialUrls.deleteMany({ group: req.model });
        await req.model.delete();
        req.flash("success", "special-urls-deleted");
        res.redirect("/tools/special-urls");
        return;
    }

    res.redirect("/tools/special-urls/" + req.model._id);
  })
);

app.post(
  "/:_id/upload",
  hasModel(SpecialUrlGroups, "_id"),
  busboy(),
  wrapAsync(async (req, res) => {
    let recipients;

    req.busboy.on("file", (fieldname, file) => {
      Papa.parse(file, {
        header: true,
        complete: function (results) {
          recipients = results.data;
        }
      });
    });

    req.busboy.on("finish", async () => {
      const expires = moment.utc().add(req.model.urlDuration, "hours");

      for (const recipient of recipients) {
        await SpecialUrls.create({
          group: req.model,
          email: recipient.EmailAddress,
          firstname: recipient.FirstName,
          lastname: recipient.LastName,
          expires
        });
      }

      res.redirect("/tools/special-urls/" + req.model._id);
    });

    req.pipe(req.busboy);
  })
);

module.exports = app;

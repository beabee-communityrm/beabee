import express from "express";
import { getRepository } from "typeorm";

import { wrapAsync } from "@core/utils";

import PageSettingsService, {
  JustPageSettings
} from "@core/services/PageSettingsService";

import Poll from "@models/Poll";

import config from "@config";

const app = express();

app.set("views", __dirname + "/views");

async function getCalloutShareSettings(
  uri: string
): Promise<JustPageSettings | undefined> {
  const [slug, ...rest] = uri.substring("/callouts/".length).split("/", 1);

  const callout = await getRepository(Poll).findOne(slug);
  if (callout) {
    return {
      shareTitle: callout.shareTitle || callout.title,
      shareDescription: callout.shareDescription || callout.excerpt,
      shareImage: callout.image,
      shareUrl: config.audience + "/callouts/" + callout.slug
    };
  }
}

app.get(
  "/",
  wrapAsync(async (req, res) => {
    let pageSettings: JustPageSettings | undefined;

    const uri = req.query.uri ? req.query.uri.toString() : undefined;
    if (uri) {
      pageSettings = uri.startsWith("/callouts/")
        ? await getCalloutShareSettings(uri)
        : PageSettingsService.getPath(uri);
    }

    res.render("index", pageSettings && { pageSettings });
  })
);

export default app;

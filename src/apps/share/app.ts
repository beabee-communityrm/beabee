import express from "express";

import { createQueryBuilder, getRepository } from "#core/database";
import { wrapAsync } from "#core/utils";

import PageSettingsService, {
  JustPageSettings
} from "#core/services/PageSettingsService";

import Callout from "#models/Callout";

import config from "#config";

const app = express();

app.set("views", __dirname + "/views");

async function getCalloutShareSettings(
  uri: string
): Promise<JustPageSettings | undefined> {
  const parts = uri.substring("/callouts/".length).split("?");
  const slug = parts[0].split("/")[0];
  const locale =
    parts[1]
      ?.split("&")
      .map((q) => q.split("="))
      .find(([k]) => k === "lang")?.[1] || "default";

  const callout = await createQueryBuilder(Callout, "c")
    .innerJoinAndSelect("c.variants", "v", "v.name = :locale", { locale })
    .where("c.slug = :slug", { slug })
    .getOne();

  if (callout) {
    const variant = callout.variants.find((v) => v.name === locale);
    if (!variant) {
      throw new Error(
        `No variant found for callout ${callout.slug} and locale ${locale}`
      );
    }

    return {
      shareTitle: variant.shareTitle || variant.title,
      shareDescription: variant.shareDescription || variant.excerpt,
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

import axios from "axios";
import express from "express";
import { Brackets } from "typeorm";

import { createQueryBuilder } from "#core/database";
import { log } from "#core/logging";
import { isAdmin } from "#core/middleware";
import { wrapAsync } from "#core/utils";

import ContactRole from "#models/ContactRole";
import ContactProfile from "#models/ContactProfile";

const app = express();

app.set("views", __dirname + "/views");

app.use(isAdmin);

interface PostcodeResponse {
  status: number;
  result: {
    query: string;
    result: {
      postcode: string;
      latitude: number;
      longitude: number;
    } | null;
  }[];
}

interface PostcodeCache {
  latitude: number;
  longitude: number;
}

function cleanPostcode(postcode: string): string {
  return postcode.toLowerCase().replace(/\s/g, "").trim();
}

const postcodeCache: { [key: string]: PostcodeCache | null } = {};

async function getPostcodes(postcodes: string[]): Promise<PostcodeCache[]> {
  const cleanPostcodes = postcodes.map(cleanPostcode);

  const dedupedPostcodes = cleanPostcodes.filter(
    (postcode, i) => cleanPostcodes.indexOf(postcode) === i
  );
  const unknownPostcodes = dedupedPostcodes.filter(
    (postcode) => postcodeCache[postcode] === undefined
  );
  log.info(`Getting ${unknownPostcodes.length} postcodes`);

  for (let i = 0; i < unknownPostcodes.length; i += 100) {
    const unknownPostcodesSlice = unknownPostcodes.slice(i, i + 100);
    log.info("Fetching postcodes", unknownPostcodesSlice);

    const resp = await axios.post(
      "https://api.postcodes.io/postcodes?filter=postcode,latitude,longitude",
      {
        postcodes: unknownPostcodesSlice
      }
    );

    const data = resp.data as PostcodeResponse;
    for (const result of data.result) {
      postcodeCache[result.query] = result.result
        ? {
            latitude: result.result.latitude,
            longitude: result.result.longitude
          }
        : null;
    }
  }

  return cleanPostcodes
    .map((postcode) => postcodeCache[postcode])
    .filter((pc): pc is PostcodeCache => pc !== null);
}

app.get("/", (req, res) => {
  res.render("index");
});

app.get(
  "/locations",
  wrapAsync(async (req, res) => {
    const now = new Date();
    const profiles = await createQueryBuilder(ContactProfile, "profile")
      .innerJoin(ContactRole, "mp", "profile.contactId = mp.contactId")
      .where("profile.deliveryOptIn = true")
      .andWhere("mp.type = 'member' AND mp.dateAdded <= :now", { now })
      .andWhere(
        new Brackets((qb) =>
          qb
            .where("mp.dateExpires >= :now", { now })
            .orWhere("mp.dateExpires = NULL")
        )
      )
      .getMany();

    const contactPostcodes = profiles
      .map((p) => p.deliveryAddress?.postcode)
      .filter((p): p is string => !!p);
    const postcodes = await getPostcodes(contactPostcodes);
    res.send({ postcodes });
  })
);

export default app;

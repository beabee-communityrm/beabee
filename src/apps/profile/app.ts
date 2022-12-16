import express from "express";
import { getRepository } from "typeorm";

import { isLoggedIn } from "@core/middleware";
import { wrapAsync } from "@core/utils";

import ContactProfile from "@models/ContactProfile";

const app = express();

app.use(isLoggedIn);

app.use(
  wrapAsync(async (req, res, next) => {
    req.user!.profile = await getRepository(ContactProfile).findOneOrFail(
      req.user!.id
    );
    next();
  })
);

export default app;

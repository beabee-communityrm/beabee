import express from "express";
import { getRepository } from "typeorm";

import { isLoggedIn } from "@core/middleware";
import { wrapAsync } from "@core/utils";

import MemberProfile from "@models/MemberProfile";

const app = express();

app.use(isLoggedIn);

app.use(
  wrapAsync(async (req, res, next) => {
    req.user!.profile = await getRepository(MemberProfile).findOneOrFail(
      req.user!.id
    );
    next();
  })
);

export default app;

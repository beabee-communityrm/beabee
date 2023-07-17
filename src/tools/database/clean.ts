import "module-alias/register";

import { subDays } from "date-fns";
import { EntityTarget, FindConditions, getRepository, LessThan } from "typeorm";

import { log as mainLogger } from "@core/logging";
import * as db from "@core/database";

import LoginOverrideFlow from "@models/LoginOverrideFlow";
import JoinFlow from "@models/JoinFlow";
import ResetPasswordFlow from "@models/ResetPasswordFlow";

const log = mainLogger.child({ app: "clean-database" });

async function clean<T>(e: EntityTarget<T>, find: FindConditions<T>) {
  const repo = getRepository(e);
  const { affected } = await repo.delete(find);
  log.info(`Cleaned ${affected} from ${repo.metadata.name}`);
}

db.connect().then(async () => {
  const now = new Date();

  await clean(LoginOverrideFlow, { date: LessThan(subDays(now, 3)) });
  await clean(ResetPasswordFlow, { date: LessThan(subDays(now, 7)) });

  await clean(JoinFlow, { date: LessThan(subDays(now, 28)) });

  await db.close();
});

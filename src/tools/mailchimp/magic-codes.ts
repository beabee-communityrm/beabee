import "module-alias/register";

import { createQueryBuilder, getRepository } from "typeorm";

import * as db from "@core/database";

import { NewsletterStatus } from "@core/providers/newsletter";
import NewsletterService from "@core/services/NewsletterService";

import LoginOverrideFlow from "@models/LoginOverrideFlow";
import Member from "@models/Member";

import config from "@config";

db.connect().then(async () => {
  const isTest = process.argv[2] === "-n";

  const members = await createQueryBuilder(Member, "m")
    .innerJoinAndSelect("m.profile", "profile")
    .where("profile.newsletterStatus = :status", {
      status: NewsletterStatus.Subscribed
    })
    .getMany();

  const loFlows = await getRepository(LoginOverrideFlow).save(
    members.map((member) => ({ member }))
  );

  const membersWithFields: [Member, Record<string, string>][] = loFlows.map(
    (loFlow) => [
      loFlow.member,
      {
        MAGICCODE: `${config.audience}/login/code/${loFlow.member.id}/${loFlow.id}?next=`
      }
    ]
  );

  if (isTest) {
    for (const [member, fields] of membersWithFields) {
      console.log(member.id, fields.MAGICCODE);
    }
    await getRepository(LoginOverrideFlow).delete(
      loFlows.map((loFlow) => loFlow.id)
    );
  } else {
    await NewsletterService.updateMembersFields(membersWithFields);
  }
  await db.close();
});

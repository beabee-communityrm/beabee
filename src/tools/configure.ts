import "module-alias/register";

import { checkbox, input } from "@inquirer/prompts";
import { getRepository } from "typeorm";

import * as db from "@core/database";

import OptionsService from "@core/services/OptionsService";

import Content from "@models/Content";

function notEmpty(s: string) {
  return s.trim() !== "";
}

db.connect().then(async () => {
  const answers = {
    emailDomain: await input({ message: "Email Domain", validate: notEmpty }),
    paymentProviders: await checkbox({
      message: "Payment Methods",
      choices: [
        { name: "Credit card (Stripe)", value: "s_card" },
        { name: "SEPA direct debit (Stripe)", value: "s_sepa" },
        { name: "BACS (Stripe)", value: "s_bacs" },
        { name: "Direct debit (GoCardless)", value: "gc_direct-debit" }
      ]
    })
  };

  await OptionsService.set("support-email", "support@" + answers.emailDomain);

  await getRepository(Content).update("join", {
    data: () =>
      `jsonb_set(data, \'{paymentMethods}\', \'${JSON.stringify(
        answers.paymentProviders
      )}\')`
  });

  await db.close();
});

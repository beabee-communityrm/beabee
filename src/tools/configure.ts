import "module-alias/register";

import inquirer, { QuestionCollection } from "inquirer";
import { getRepository } from "typeorm";

import * as db from "@core/database";

import OptionsService from "@core/services/OptionsService";

import Content from "@models/Content";

function notEmpty(msg: string) {
  return (s: string) => {
    return s.trim() === "" ? msg : true;
  };
}

const questions: QuestionCollection[] = [];

questions.push({
  type: "input",
  name: "emailDomain",
  message: "Email Domain",
  validate: notEmpty("You must enter an email domain")
});

questions.push({
  type: "checkbox",
  name: "paymentProviders",
  message: "Payment Methods",
  choices: [
    { name: "Credit card (Stripe)", value: "s_card" },
    { name: "SEPA direct debit (Stripe)", value: "s_sepa" },
    { name: "BACS (Stripe)", value: "s_bacs" },
    { name: "Direct debit (GoCardless)", value: "gc_direct-debit" }
  ]
});

db.connect().then(async () => {
  const answers = await inquirer.prompt(questions);

  await OptionsService.set("support-email", "support@" + answers.emailDomain);

  await getRepository(Content).update("join", {
    data: () =>
      `jsonb_set(data, \'{paymentMethods}\', \'${JSON.stringify(
        answers.paymentProviders
      )}\')`
  });

  await db.close();
});

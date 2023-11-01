import "module-alias/register";

import inquirer, { QuestionCollection } from "inquirer";

import * as db from "@core/database";

import OptionsService from "@core/services/OptionsService";

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

db.connect().then(async () => {
  const answers = await inquirer.prompt(questions);

  await OptionsService.set("support-email", "support@" + answers.emailDomain);

  await db.close();
});

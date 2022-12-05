import "module-alias/register";

import { ContributionType } from "@beabee/beabee-common";
import inquirer, { QuestionCollection } from "inquirer";
import moment from "moment";
import { getRepository } from "typeorm";

import * as db from "@core/database";
import { generatePassword, passwordRequirements } from "@core/utils/auth";

import ContactsService from "@core/services/ContactsService";

import ContactRole from "@models/ContactRole";

const questions: QuestionCollection[] = [];

// First Name
questions.push({
  type: "input",
  name: "firstname",
  message: "First Name",
  validate: function (s) {
    return s.trim() === "" ? "You must enter a first name" : true;
  }
});

// Last Name
questions.push({
  type: "input",
  name: "lastname",
  message: "Last Name",
  validate: function (s) {
    return s.trim() === "" ? "You must enter a last name" : true;
  }
});

// Email address
questions.push({
  type: "input",
  name: "email",
  message: "Email Address",
  validate: function (s) {
    return s.trim() === "" ? "You must enter an email address" : true;
  }
});

// Password
questions.push({
  type: "password",
  name: "password",
  message: "Password",
  validate: function (s) {
    return passwordRequirements(s);
  }
});

// Member
questions.push({
  type: "list",
  name: "membership",
  message: "Would you like to grant membership to the user?",
  choices: [
    "Yes",
    "Yes (expires after 1 month)",
    "Yes (expired yesterday)",
    "No"
  ],
  default: "Yes"
});

// Level question
questions.push({
  type: "list",
  name: "permission",
  message: "What level of access do you wish to grant this new user?",
  choices: ["None", "Admin", "Super Admin"],
  default: "Super Admin"
});

db.connect().then(async () => {
  const answers = await inquirer.prompt(questions);

  const password = await generatePassword(answers.password);

  const roles = [];

  if (answers.membership != "No") {
    const now = moment();
    let dateAdded: Date | null = null;
    let dateExpires: Date | null = null;
    switch (answers.membership) {
      case "Yes (expires after 1 month)":
        dateExpires = now.add("1", "months").toDate();
        break;
      case "Yes (expired yesterday)":
        dateAdded = now.subtract("1", "months").toDate();
        dateExpires = now.subtract("1", "day").toDate();
        break;
    }

    const membership = getRepository(ContactRole).create({
      type: "member",
      ...(dateAdded && { dateAdded }),
      dateExpires
    });
    roles.push(membership);
  }

  if (answers.permission != "None") {
    const admin = getRepository(ContactRole).create({
      type: answers.permission === "Admin" ? "admin" : "superadmin"
    });
    roles.push(admin);
  }

  await ContactsService.createContact({
    firstname: answers.firstname,
    lastname: answers.lastname,
    email: answers.email,
    contributionType: ContributionType.None,
    roles: roles,
    password
  });

  await db.close();
});

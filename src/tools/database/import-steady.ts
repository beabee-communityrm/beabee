import "module-alias/register";

import {
  ContributionPeriod,
  ContributionType,
  NewsletterStatus
} from "@beabee/beabee-common";
import { parse } from "csv-parse";
import { In } from "typeorm";

import { getRepository } from "@core/database";
import { runApp } from "@core/server";
import { cleanEmailAddress } from "@core/utils";

import ContactsService from "@core/services/ContactsService";

import Contact from "@models/Contact";
import ContactRole from "@models/ContactRole";

import { Address } from "@type/address";

const headers = [
  "first_name",
  "last_name",
  "email",
  "plan_name",
  "plan_monthly_amount_cents",
  "gifted",
  "subscription_period",
  "subscription_state",
  "subscribed_at",
  "trial_ends_at",
  "cancelled_at",
  "expires_at",
  "shipping_first_name",
  "shipping_last_name",
  "shipping_company_name",
  "shipping_street_and_number",
  "shipping_city",
  "shipping_zip_code",
  "shipping_state",
  "shipping_country_code"
] as const;

interface SteadyRow {
  first_name: string;
  last_name: string;
  email: string;
  plan_name: string;
  plan_monthly_amount_cents: number;
  gifted: boolean;
  subscription_period: "annual" | "monthly";
  subscription_state: string;
  subscribed_at: string;
  trial_ends_at: string;
  cancelled_at: string;
  expires_at: string;
  shipping_first_name: string;
  shipping_last_name: string;
  shipping_company_name: string;
  shipping_street_and_number: string;
  shipping_city: string;
  shipping_zip_code: string;
  shipping_state: string;
  shipping_country_code: string;
}

type RawSteadyRow = { [k in keyof SteadyRow]: string };

const isDangerMode = process.argv.includes("--danger");

/**
 * Check if a row is a valid Steady row
 *
 * @param row  A row from the CSV file
 * @returns  Whether the row is valid
 */
function isSteadyRow(row: any): row is RawSteadyRow {
  return (
    typeof row === "object" &&
    headers.every((header) => typeof row[header] === "string") &&
    ["true", "false"].includes(row.gifted) &&
    ["annual", "monthly"].includes(row.subscription_period) &&
    !isNaN(parseInt(row.plan_monthly_amount_cents))
  );
}

/**
 * Convert Steady's period to beabee's period
 *
 * @param period Steady's period
 * @returns beabee's period
 */
function convertPeriod(period: "annual" | "monthly"): ContributionPeriod {
  return period === "annual"
    ? ContributionPeriod.Annually
    : ContributionPeriod.Monthly;
}

function getRole(row: SteadyRow): ContactRole {
  return getRepository(ContactRole).create({
    type: "member",
    dateAdded: new Date(row.subscribed_at),
    dateExpires: row.expires_at ? new Date(row.expires_at) : null
  });
}

/**
 * Get delivery address and opt in from a row
 *
 * @param row
 * @returns [deliveryOptIn, deliveryAddress]
 */
function getDeliveryAddress(row: SteadyRow): [boolean, Address | null] {
  if (row.shipping_street_and_number) {
    return [
      true,
      {
        line1: row.shipping_company_name || row.shipping_street_and_number,
        line2: row.shipping_company_name ? row.shipping_street_and_number : "",
        city: row.shipping_city,
        postcode: row.shipping_zip_code
      }
    ];
  } else {
    return [false, null];
  }
}

async function setContributionData(contact: Contact, row: SteadyRow) {
  const period = convertPeriod(row.subscription_period);

  await ContactsService.forceUpdateContactContribution(contact, {
    type: ContributionType.Manual,
    source: "Steady",
    reference: row.plan_name,
    period,
    amount:
      (row.plan_monthly_amount_cents / 100) *
      (period === ContributionPeriod.Annually ? 12 : 1)
  });
}

/**
 * Update an existing contact from a row
 *
 * @param contact
 * @param row
 * @returns
 */
async function updateExistingContact(contact: Contact, row: SteadyRow) {
  if (contact.contributionType !== ContributionType.Manual) {
    console.error(
      `${contact.email} has contribution type ${contact.contributionType}, can't update`
    );
    return;
  }

  console.error("Updating " + contact.email);
  if (!isDangerMode) {
    return;
  }

  await ContactsService.updateContact(contact, {
    contributionMonthlyAmount: row.plan_monthly_amount_cents / 100,
    firstname: row.first_name,
    lastname: row.last_name
  });

  // If the contact is already a member, use extend instead to ensure
  // the role expiry date isn't reduced
  const role = getRole(row);
  if (contact.membership?.isActive) {
    if (role.dateExpires) {
      await ContactsService.extendContactRole(
        contact,
        "member",
        role.dateExpires
      );
    }
  } else {
    await ContactsService.updateContactRole(contact, "member", role);
  }

  const [deliveryOptIn, deliveryAddress] = getDeliveryAddress(row);
  await ContactsService.updateContactProfile(contact, {
    deliveryOptIn,
    deliveryAddress,
    tags: ["Steady"]
  });

  await setContributionData(contact, row);
}

/**
 * Create a new contact from a row
 *
 * @param row A row from the CSV file
 */
async function addNewContact(row: SteadyRow) {
  const joined = new Date(row.subscribed_at);

  const [deliveryOptIn, deliveryAddress] = getDeliveryAddress(row);

  console.error("Adding " + row.email);
  if (!isDangerMode) {
    return;
  }

  const contact = await ContactsService.createContact(
    {
      email: row.email,
      firstname: row.first_name,
      lastname: row.last_name,
      joined,
      roles: [getRole(row)]
    },
    {
      deliveryOptIn,
      deliveryAddress,
      newsletterStatus: NewsletterStatus.None,
      tags: ["Steady"]
    }
  );

  await setContributionData(contact, row);
}

/**
 * Process all rows from the CSV file, adding new contacts and updating existing
 * ones
 *
 * @param rows All validated rows from the CSV file
 */
async function processRows(rows: SteadyRow[]) {
  console.error(`Processing ${rows.length} rows`);

  const existingContacts = await getRepository(Contact).find({
    where: { email: In(rows.map((row) => row.email)) }
  });

  const existingEmails = existingContacts.map((c) => c.email);

  let added = 0,
    updated = 0;

  for (const contact of existingContacts) {
    const row = rows.find((r) => r.email === contact.email) as SteadyRow;
    await updateExistingContact(contact, row);
    updated++;
  }

  for (const row of rows) {
    if (!existingEmails.includes(row.email)) {
      await addNewContact(row);
      added++;
    }
  }

  console.error(`Added ${added} contacts, updated ${updated} contacts`);
}

async function loadRows(): Promise<SteadyRow[]> {
  return new Promise((resolve) => {
    const rows: SteadyRow[] = [];

    process.stdin
      .pipe(
        parse({
          columns: true,
          skipEmptyLines: true
        })
      )
      .on("data", (row) => {
        if (isSteadyRow(row)) {
          rows.push({
            ...row,
            email: cleanEmailAddress(row.email),
            plan_monthly_amount_cents: parseInt(row.plan_monthly_amount_cents),
            gifted: row.gifted === "true",
            subscription_period: row.subscription_period as "annual" | "monthly"
          });
        } else {
          console.error("Invalid row", row);
        }
      })
      .on("end", () => resolve(rows));
  });
}

runApp(async () => {
  const rows = await loadRows();
  await processRows(rows);
});

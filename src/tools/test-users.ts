import "module-alias/register";

import {
  ContributionPeriod,
  ContributionType,
  PaymentStatus
} from "@beabee/beabee-common";
import moment from "moment";
import { Brackets } from "typeorm";

import { createQueryBuilder } from "@core/database";
import { runApp } from "@core/server";
import { getActualAmount } from "@core/utils";

import config from "@config";

import Payment from "@models/Payment";
import Contact from "@models/Contact";
import PaymentData from "@models/PaymentData";

async function logContact(type: string, conditions: Brackets[]) {
  const qb = createQueryBuilder(Contact, "m")
    .innerJoinAndSelect("m.roles", "mp")
    .where("TRUE");

  for (const condition of conditions) {
    qb.andWhere(condition);
  }

  const contact = await qb.getOne();
  console.log("# " + type);
  if (contact) {
    console.log(contact.fullname + ", " + contact.email);
    console.log(config.audience + "/login/as/" + contact.id);
  } else {
    console.log("No contact found");
  }
  console.log();
}

async function logContactVaryContributions(
  type: string,
  conditions: Brackets[]
) {
  const amounts = [1, 3, 5];
  for (const amount of amounts) {
    for (const period of [
      ContributionPeriod.Monthly,
      ContributionPeriod.Annually
    ]) {
      await logContact(
        `${type}, £${getActualAmount(amount, period)}/${period}`,
        [
          ...conditions,
          new Brackets((qb) =>
            qb.where(
              "m.contributionMonthlyAmount = :amount AND m.contributionPeriod = :period",
              {
                amount,
                period
              }
            )
          )
        ]
      );
    }
  }
}

async function getFilters() {
  const now = moment.utc();

  const hasScheduledPayments = createQueryBuilder()
    .subQuery()
    .select("p.contactId")
    .from(Payment, "p")
    .where("p.status = :status", { status: PaymentStatus.Pending });
  const hasFailedPayments = createQueryBuilder()
    .subQuery()
    .select("p.contactId")
    .from(Payment, "p")
    .where("p.status = 'failed'", { status: PaymentStatus.Failed });
  const hasSubscription = createQueryBuilder()
    .subQuery()
    .select("pd.contactId")
    .from(PaymentData, "p")
    .where("pd.subscriptionId IS NOT NULL");
  const hasCancelled = createQueryBuilder()
    .subQuery()
    .select("pd.contactId")
    .from(PaymentData, "md")
    .where("md.cancelledAt IS NOT NULL");
  const isPayingFee = createQueryBuilder()
    .subQuery()
    .select("md.contactId")
    .from(PaymentData, "md")
    .where("md.payFee = TRUE");

  return {
    isActive: new Brackets((qb) =>
      qb.where("mp.type = 'member' AND mp.dateExpires > :now", { now })
    ),
    isInactive: new Brackets((qb) =>
      qb.where("mp.type = 'member' AND mp.dateExpires < :now", { now })
    ),
    isSuperAdmin: new Brackets((qb) => qb.where("mp.type = 'superadmin'")),
    isGift: new Brackets((qb) =>
      qb.where("m.contributionType = :gift", { gift: ContributionType.Gift })
    ),
    hasSubscription: new Brackets((qb) =>
      qb.where("m.id IN " + hasSubscription.getQuery())
    ),
    hasCancelled: new Brackets((qb) =>
      qb.where("m.id IN " + hasCancelled.getQuery())
    ),
    isPayingFee: new Brackets((qb) =>
      qb.where("m.id IN " + isPayingFee.getQuery())
    ),
    noScheduledPayments: new Brackets((qb) =>
      qb.where("m.id NOT IN " + hasScheduledPayments.getQuery())
    ),
    hasScheduledPayments: new Brackets((qb) =>
      qb.where("m.id IN " + hasScheduledPayments.getQuery())
    ),
    noFailedPayments: new Brackets((qb) =>
      qb.where("m.id NOT IN " + hasFailedPayments.getQuery())
    ),
    hasFailedPayments: new Brackets((qb) =>
      qb.where("m.id IN " + hasFailedPayments.getQuery())
    )
  } as const;
}

async function main() {
  const filters = await getFilters();

  await logContactVaryContributions("Active, no scheduled payments", [
    filters.isActive,
    filters.noScheduledPayments
  ]);

  await logContactVaryContributions("Active, has scheduled payments", [
    filters.isActive,
    filters.hasScheduledPayments
  ]);

  await logContactVaryContributions("Inactive due to failed payment", [
    filters.hasSubscription,
    filters.isInactive,
    filters.hasFailedPayments
  ]);

  await logContactVaryContributions(
    "Inactive due to failed payment, has scheduled payments",
    [
      filters.hasSubscription,
      filters.isInactive,
      filters.hasFailedPayments,
      filters.hasScheduledPayments
    ]
  );
  await logContactVaryContributions("Cancelled active member", [
    filters.isActive,
    filters.hasCancelled
  ]);

  await logContactVaryContributions("Cancelled inactive member", [
    filters.isInactive,
    filters.hasCancelled
  ]);

  await logContact("Active, gift membership", [
    filters.isActive,
    filters.isGift
  ]);

  await logContact("Inactive, gift membership", [
    filters.isInactive,
    filters.isGift
  ]);

  await logContact("Active, paying fee", [
    filters.isActive,
    filters.isPayingFee
  ]);

  await logContact("Super admin account", [filters.isSuperAdmin]);
}

runApp(async () => {
  console.log();
  try {
    await main();
  } catch (err) {
    console.error(err);
  }
});

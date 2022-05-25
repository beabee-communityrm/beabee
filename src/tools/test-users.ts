import "module-alias/register";

import moment from "moment";
import { Brackets, createQueryBuilder } from "typeorm";

import * as db from "@core/database";
import {
  ContributionPeriod,
  ContributionType,
  getActualAmount
} from "@core/utils";

import config from "@config";

import Payment, { PaymentStatus } from "@models/Payment";
import Member from "@models/Member";
import PaymentData from "@models/PaymentData";

async function logMember(type: string, conditions: Brackets[]) {
  const qb = createQueryBuilder(Member, "m")
    .innerJoinAndSelect("m.permissions", "mp")
    .where("TRUE");

  for (const condition of conditions) {
    qb.andWhere(condition);
  }

  const member = await qb.getOne();
  console.log("# " + type);
  if (member) {
    console.log(member.fullname + ", " + member.email);
    console.log(config.audience + "/login/as/" + member.id);
  } else {
    console.log("No member found");
  }
  console.log();
}

async function logMemberVaryContributions(
  type: string,
  conditions: Brackets[]
) {
  const amounts = [1, 3, 5];
  for (const amount of amounts) {
    for (const period of [
      ContributionPeriod.Monthly,
      ContributionPeriod.Annually
    ]) {
      await logMember(
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
    .select("p.memberId")
    .from(Payment, "p")
    .where("p.status = :status", { status: PaymentStatus.Pending });
  const hasFailedPayments = createQueryBuilder()
    .subQuery()
    .select("p.memberId")
    .from(Payment, "p")
    .where("p.status = 'failed'", { status: PaymentStatus.Failed });
  const hasSubscription = createQueryBuilder()
    .subQuery()
    .select("pd.memberId")
    .from(PaymentData, "p")
    .where("pd.subscriptionId IS NOT NULL");
  const hasCancelled = createQueryBuilder()
    .subQuery()
    .select("pd.memberId")
    .from(PaymentData, "md")
    .where("md.cancelledAt IS NOT NULL");
  const isPayingFee = createQueryBuilder()
    .subQuery()
    .select("md.memberId")
    .from(PaymentData, "md")
    .where("md.payFee = TRUE");

  return {
    isActive: new Brackets((qb) =>
      qb.where("mp.permission = 'member' AND mp.dateExpires > :now", { now })
    ),
    isInactive: new Brackets((qb) =>
      qb.where("mp.permission = 'member' AND mp.dateExpires < :now", { now })
    ),
    isSuperAdmin: new Brackets((qb) =>
      qb.where("mp.permission = 'superadmin'")
    ),
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

  await logMemberVaryContributions("Active, no scheduled payments", [
    filters.isActive,
    filters.noScheduledPayments
  ]);

  await logMemberVaryContributions("Active, has scheduled payments", [
    filters.isActive,
    filters.hasScheduledPayments
  ]);

  await logMemberVaryContributions("Inactive due to failed payment", [
    filters.hasSubscription,
    filters.isInactive,
    filters.hasFailedPayments
  ]);

  await logMemberVaryContributions(
    "Inactive due to failed payment, has scheduled payments",
    [
      filters.hasSubscription,
      filters.isInactive,
      filters.hasFailedPayments,
      filters.hasScheduledPayments
    ]
  );
  await logMemberVaryContributions("Cancelled active member", [
    filters.isActive,
    filters.hasCancelled
  ]);

  await logMemberVaryContributions("Cancelled inactive member", [
    filters.isInactive,
    filters.hasCancelled
  ]);

  await logMember("Active, gift membership", [
    filters.isActive,
    filters.isGift
  ]);

  await logMember("Inactive, gift membership", [
    filters.isInactive,
    filters.isGift
  ]);

  await logMember("Active, paying fee", [
    filters.isActive,
    filters.isPayingFee
  ]);

  await logMember("Super admin account", [filters.isSuperAdmin]);
}

db.connect().then(async () => {
  console.log();
  try {
    await main();
  } catch (err) {
    console.error(err);
  }
  await db.close();
});

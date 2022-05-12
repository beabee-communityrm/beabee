import express from "express";
import { getRepository } from "typeorm";

import { hasSchema, isSuperAdmin } from "@core/middleware";
import {
  ContributionPeriod,
  ContributionType,
  createDateTime,
  wrapAsync
} from "@core/utils";

import GCPaymentService from "@core/services/GCPaymentService";
import MembersService from "@core/services/MembersService";
import OptionsService from "@core/services/OptionsService";

import { NewsletterStatus } from "@core/providers/newsletter";

import ManualPaymentData from "@models/ManualPaymentData";
import MemberPermission, { PermissionType } from "@models/MemberPermission";

import { addContactSchema } from "./schemas.json";

import DuplicateEmailError from "@api/errors/DuplicateEmailError";

interface BaseAddContactSchema {
  email: string;
  firstname?: string;
  lastname?: string;
  permissions?: {
    permission: PermissionType;
    startDate?: string;
    startTime?: string;
    expiryDate?: string;
    expiryTime?: string;
  }[];
  addToNewsletter?: boolean;
  addAnother?: boolean;
}

interface AddManualContactSchema extends BaseAddContactSchema {
  type: ContributionType.Manual;
  source?: string;
  reference?: string;
  amount?: number;
  period?: ContributionPeriod;
}

interface AddGCContactSchema extends BaseAddContactSchema {
  type: ContributionType.Automatic;
  customerId: string;
  mandateId: string;
  amount?: number;
  period?: ContributionPeriod;
  payFee?: boolean;
}

interface AddNoneContactScema extends BaseAddContactSchema {
  type: ContributionType.None;
}

type AddContactSchema =
  | AddManualContactSchema
  | AddGCContactSchema
  | AddNoneContactScema;

const app = express();

app.set("views", __dirname + "/views");

app.use(isSuperAdmin);

app.get("/", (req, res) => {
  res.render("index");
});

app.post(
  "/",
  hasSchema(addContactSchema).orFlash,
  wrapAsync(async (req, res) => {
    const data = req.body as AddContactSchema;

    const permissions =
      data.permissions?.map((p) => {
        const dateAdded = createDateTime(p.startDate, p.startTime);
        return getRepository(MemberPermission).create({
          permission: p.permission,
          ...(dateAdded && { dateAdded }),
          dateExpires: createDateTime(p.expiryDate, p.expiryTime)
        });
      }) || [];

    let member;
    try {
      member = await MembersService.createMember(
        {
          email: data.email,
          contributionType: data.type,
          firstname: data.firstname || "",
          lastname: data.lastname || "",
          permissions
        },
        data.addToNewsletter
          ? {
              newsletterStatus: NewsletterStatus.Subscribed,
              newsletterGroups: OptionsService.getList(
                "newsletter-default-groups"
              )
            }
          : undefined
      );
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        req.flash("danger", "email-duplicate");
        res.redirect("/members/add");
        return;
      } else {
        throw error;
      }
    }

    if (data.type === ContributionType.Automatic) {
      await GCPaymentService.updatePaymentSource(
        member,
        data.customerId,
        data.mandateId
      );
      if (data.amount && data.period) {
        await MembersService.updateMemberContribution(member, {
          monthlyAmount: data.amount,
          period: data.period,
          payFee: !!data.payFee,
          prorate: false
        });
      }
    } else if (data.type === ContributionType.Manual) {
      const paymentData = getRepository(ManualPaymentData).create({
        member,
        source: data.source || "",
        reference: data.reference || ""
      });
      await getRepository(ManualPaymentData).save(paymentData);
      await MembersService.updateMember(member, {
        contributionPeriod: data.period || null,
        contributionMonthlyAmount: data.amount || null
      });
    }

    req.flash("success", "member-added");
    res.redirect(data.addAnother ? "/members/add" : "/members/" + member.id);
  })
);

export default app;

import {
  CalloutComponentSchema,
  CalloutResponseAnswer
} from "@beabee/beabee-common";
import { Chance } from "chance";
import crypto from "crypto";
import { EntityTarget } from "typeorm";
import { v4 as uuidv4 } from "uuid";

import Email from "@models/Email";
import EmailMailing from "@models/EmailMailing";
import Export from "@models/Export";
import ExportItem from "@models/ExportItem";
import GiftFlow from "@models/GiftFlow";
import Contact from "@models/Contact";
import ContactRole from "@models/ContactRole";
import ContactProfile from "@models/ContactProfile";
import Notice from "@models/Notice";
import Option from "@models/Option";
import PageSettings from "@models/PageSettings";
import Payment from "@models/Payment";
import PaymentData from "@models/PaymentData";
import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";
import CalloutResponseTag from "@models/CalloutResponseTag";
import CalloutTag from "@models/CalloutTag";
import Project from "@models/Project";
import ProjectContact from "@models/ProjectContact";
import ProjectEngagement from "@models/ProjectEngagement";
import Referral from "@models/Referral";
import ReferralGift from "@models/ReferralGift";
import Segment from "@models/Segment";
import SegmentContact from "@models/SegmentContact";
import SegmentOngoingEmail from "@models/SegmentOngoingEmail";
import CalloutResponseComment from "@models/CalloutResponseComment";
import ResetSecurityFlow from "@models/ResetSecurityFlow";

export type PropertyMap<T> = ((prop: T) => T) | ObjectMap<T>;
export type ObjectMap<T> = { [K in keyof T]?: PropertyMap<T[K]> };

export interface ModelAnonymiser<T> {
  model: EntityTarget<T>;
  objectMap: ObjectMap<T>;
}

// Functions to facilitate type checking when creating anonymisers

function createModelAnonymiser<T>(
  model: EntityTarget<T>,
  objectMap: ObjectMap<T> = {}
): ModelAnonymiser<T> {
  return { model, objectMap };
}

function createObjectMap<T>(objectMap: ObjectMap<T>): ObjectMap<T> {
  return objectMap;
}

export function createComponentAnonymiser(
  component: CalloutComponentSchema
): (
  v: CalloutResponseAnswer | CalloutResponseAnswer[]
) => CalloutResponseAnswer | CalloutResponseAnswer[] {
  function anonymiseAnswer(v: CalloutResponseAnswer): CalloutResponseAnswer {
    switch (component.type) {
      case "address":
        return {
          formatted_address: chance.address(),
          geometry: {
            location: { lat: chance.latitude(), lng: chance.longitude() }
          }
        };
      case "email":
        return chance.email({ domain: "example.com", length: 10 });
      case "checkbox":
        return chance.pickone([true, false]);
      case "number":
        return chance.integer();
      case "password":
        return chance.word();
      case "textarea":
        return chance.paragraph();
      case "textfield":
        return chance.sentence();
      case "button":
        return v;

      case "select":
      case "radio":
      case "selectboxes":
        const values =
          component.type === "select"
            ? component.data.values
            : component.values;
        return chance.pickone(values.map(({ value }) => value));
    }
  }

  return (v) => {
    return Array.isArray(v) ? v.map(anonymiseAnswer) : anonymiseAnswer(v);
  };
}
// Property generators

const chance = new Chance();

function copy<T>(a: T): T {
  return a;
}

function randomId(len: number, prefix?: string) {
  return () =>
    (prefix || "") +
    crypto.randomBytes(6).toString("hex").slice(0, len).toUpperCase();
}

let codeNo = 0;
function uniqueCode(): string {
  codeNo++;
  const letter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(codeNo / 1000)];
  const no = codeNo % 1000;
  return letter.padStart(2, "A") + (no + "").padStart(3, "0");
}

// Relations will be strings but the type checker thinks they will be objects
const relationId = () => uuidv4() as any;

// Model anonymisers

export const calloutsAnonymiser = createModelAnonymiser(Callout);

export const calloutResponsesAnonymiser = createModelAnonymiser(
  CalloutResponse,
  {
    id: () => uuidv4(),
    contact: relationId,
    assignee: relationId,
    guestName: () => chance.name(),
    guestEmail: () => chance.email({ domain: "example.com", length: 10 })
  }
);

export const calloutResponseCommentsAnonymiser = createModelAnonymiser(
  CalloutResponseComment,
  {
    id: () => uuidv4(),
    response: relationId,
    contact: relationId,
    text: () => chance.paragraph()
  }
);

export const calloutResponseTagsAnonymiser = createModelAnonymiser(
  CalloutResponseTag,
  {
    response: relationId,
    tag: relationId
  }
);

export const calloutTagsAnonymiser = createModelAnonymiser(CalloutTag, {
  id: () => uuidv4(),
  name: () => chance.word(),
  description: () => chance.sentence()
});

export const contactAnonymiser = createModelAnonymiser(Contact, {
  id: () => uuidv4(),
  email: () => chance.email({ domain: "fake.beabee.io", length: 10 }),
  firstname: () => chance.first(),
  lastname: () => chance.last(),
  password: () => ({ hash: "", salt: "", iterations: 0, tries: 0 }),
  pollsCode: uniqueCode,
  referralCode: uniqueCode
});

export const contactProfileAnonymiser = createModelAnonymiser(ContactProfile, {
  contact: relationId,
  description: () => chance.sentence(),
  bio: () => chance.paragraph(),
  notes: () => chance.sentence(),
  telephone: () => chance.phone(),
  twitter: () => chance.twitter(),
  deliveryAddress: () => ({
    line1: chance.address(),
    line2: chance.pickone(["Cabot", "Easton", "Southmead", "Hanham"]),
    city: "Bristol",
    postcode: "BS1 1AA"
  }),
  tags: (tags) => tags.map(() => chance.profession())
});

export const contactRoleAnonymiser = createModelAnonymiser(ContactRole, {
  contact: relationId
});

export const emailAnonymiser = createModelAnonymiser(Email);

export const emailMailingAnonymiser = createModelAnonymiser(EmailMailing, {
  recipients: () => []
});

export const exportsAnonymiser = createModelAnonymiser(Export);

export const exportItemsAnonymiser = createModelAnonymiser(ExportItem, {
  itemId: copy // These will be mapped to values that have already been seen
});

export const giftFlowAnonymiser = createModelAnonymiser(GiftFlow, {
  id: () => uuidv4(),
  setupCode: uniqueCode,
  sessionId: randomId(12),
  giftForm: createObjectMap<GiftFlow["giftForm"]>({
    firstname: () => chance.first(),
    lastname: () => chance.last(),
    email: () => chance.email({ domain: "fake.beabee.io", length: 10 }),
    message: () => chance.sentence(),
    fromName: () => chance.name(),
    fromEmail: () => chance.email({ domain: "fake.beabee.io", length: 10 })
  }),
  giftee: relationId
});

export const noticesAnonymiser = createModelAnonymiser(Notice);

export const optionsAnonymiser = createModelAnonymiser(Option);

export const pageSettingsAnonymiser = createModelAnonymiser(PageSettings);

export const paymentDataAnonymiser = createModelAnonymiser(PaymentData, {
  contact: relationId,
  data: createObjectMap<PaymentData["data"]>({
    customerId: randomId(12, "CU"),
    mandateId: randomId(12, "MD"),
    subscriptionId: randomId(12, "SB"),
    source: () => chance.pickone(["Standing Order", "PayPal", "Cash in hand"]),
    reference: () => chance.word()
  })
});

export const paymentsAnonymiser = createModelAnonymiser(Payment, {
  id: () => uuidv4(),
  subscriptionId: randomId(12, "SB"),
  contact: relationId
});

export const projectsAnonymiser = createModelAnonymiser(Project, {
  owner: relationId
});

export const projectContactsAnonymiser = createModelAnonymiser(ProjectContact, {
  id: () => uuidv4(),
  contact: relationId,
  tag: () => chance.profession()
});

export const projectEngagmentsAnonymiser = createModelAnonymiser(
  ProjectEngagement,
  {
    id: () => uuidv4(),
    byContact: relationId,
    toContact: relationId,
    notes: () => chance.sentence()
  }
);

export const referralsAnonymiser = createModelAnonymiser(Referral, {
  id: () => uuidv4(),
  referrer: relationId,
  referee: relationId
});

export const referralsGiftAnonymiser = createModelAnonymiser(ReferralGift, {
  stock: copy // Add to map so it is serialised correctly
});

export const ResetSecurityFlowAnonymiser = createModelAnonymiser(
  ResetSecurityFlow,
  {
    id: () => uuidv4(),
    contact: relationId
  }
);

export const segmentsAnonymiser = createModelAnonymiser(Segment);

export const segmentContactsAnonymiser = createModelAnonymiser(SegmentContact, {
  contact: relationId
});

export const segmentOngoingEmailsAnonymiser =
  createModelAnonymiser(SegmentOngoingEmail);

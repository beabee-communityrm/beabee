import { Chance } from "chance";
import crypto from "crypto";
import {
  createQueryBuilder,
  EntityTarget,
  getRepository,
  OrderByCondition,
  SelectQueryBuilder
} from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { v4 as uuidv4 } from "uuid";

import { log as mainLogger } from "@core/logging";

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
import CalloutResponse, {
  CalloutResponseAnswer,
  CalloutResponseAnswers
} from "@models/CalloutResponse";
import Project from "@models/Project";
import ProjectContact from "@models/ProjectContact";
import ProjectEngagement from "@models/ProjectEngagement";
import Referral from "@models/Referral";
import ReferralGift from "@models/ReferralGift";
import Segment from "@models/Segment";
import SegmentContact from "@models/SegmentContact";
import SegmentOngoingEmail from "@models/SegmentOngoingEmail";
import {
  CalloutComponentSchema,
  flattenComponents
} from "@beabee/beabee-common";

const log = mainLogger.child({ app: "drier" });

export interface Drier<T> {
  propMap: DrierMap<T>;
}

type DrierMap<T> = { [K in keyof T]?: ((prop: T[K]) => T[K]) | Drier<T[K]> };

export interface ModelDrier<T> extends Drier<T> {
  model: EntityTarget<T>;
}

function createModelDrier<T>(
  model: EntityTarget<T>,
  propMap: DrierMap<T> = {}
): ModelDrier<T> {
  return { model, propMap };
}

function createDrier<T>(propMap: DrierMap<T> = {}): Drier<T> {
  return { propMap };
}

// Property generators

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

// Relations are loaded with loadRelationIds
const contactId = () => uuidv4() as unknown as Contact;

const chance = new Chance();

// Model driers

const emailDrier = createModelDrier(Email);

const emailMailingDrier = createModelDrier(EmailMailing, {
  recipients: () => []
});

const exportsDrier = createModelDrier(Export);

const exportItemsDrier = createModelDrier(ExportItem, {
  itemId: copy // These will be mapped to values that have already been seen
});

export const paymentsDrier = createModelDrier(Payment, {
  id: () => uuidv4(),
  subscriptionId: randomId(12, "SB"),
  contact: contactId
});

export const paymentDataDrier = createModelDrier(PaymentData, {
  contact: contactId,
  data: createDrier<PaymentData["data"]>({
    customerId: randomId(12, "CU"),
    mandateId: randomId(12, "MD"),
    subscriptionId: randomId(12, "SB"),
    source: () => chance.pickone(["Standing Order", "PayPal", "Cash in hand"]),
    reference: () => chance.word()
  })
});

const giftFlowDrier = createModelDrier(GiftFlow, {
  id: () => uuidv4(),
  setupCode: uniqueCode,
  sessionId: randomId(12),
  giftForm: createDrier<GiftFlow["giftForm"]>({
    firstname: () => chance.first(),
    lastname: () => chance.last(),
    email: () => chance.email({ domain: "fake.beabee.io", length: 10 }),
    message: () => chance.sentence(),
    fromName: () => chance.name(),
    fromEmail: () => chance.email({ domain: "fake.beabee.io", length: 10 })
  }),
  giftee: contactId
});

export const contactDrier = createModelDrier(Contact, {
  id: () => uuidv4(),
  email: () => chance.email({ domain: "fake.beabee.io", length: 10 }),
  firstname: () => chance.first(),
  lastname: () => chance.last(),
  otp: () => ({ activated: false, key: null }),
  password: () => ({ hash: "", salt: "", iterations: 0, tries: 0 }),
  pollsCode: uniqueCode,
  referralCode: uniqueCode
});

export const contactRoleDrier = createModelDrier(ContactRole, {
  contact: contactId
});

export const contacrProfileDrier = createModelDrier(ContactProfile, {
  contact: contactId,
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

const noticesDrier = createModelDrier(Notice);

const optionsDrier = createModelDrier(Option);

const pageSettingsDrier = createModelDrier(PageSettings);

export const calloutsDrier = createModelDrier(Callout);

export const calloutResponsesDrier = createModelDrier(CalloutResponse, {
  id: () => uuidv4(),
  contact: contactId,
  guestName: () => chance.name(),
  guestEmail: () => chance.email({ domain: "example.com", length: 10 })
});

const projectsDrier = createModelDrier(Project, {
  owner: contactId
});

const projectContactsDrier = createModelDrier(ProjectContact, {
  id: () => uuidv4(),
  contact: contactId,
  tag: () => chance.profession()
});

const projectEngagmentsDrier = createModelDrier(ProjectEngagement, {
  id: () => uuidv4(),
  byContact: contactId,
  toContact: contactId,
  notes: () => chance.sentence()
});

const referralsDrier = createModelDrier(Referral, {
  id: () => uuidv4(),
  referrer: contactId,
  referee: contactId
});

const referralsGiftDrier = createModelDrier(ReferralGift, {
  stock: copy // Add to map so it is serialised correctly
});

const segmentsDrier = createModelDrier(Segment);

const segmentContactsDrier = createModelDrier(SegmentContact, {
  contact: contactId
});

const segmentOngoingEmailsDrier = createModelDrier(SegmentOngoingEmail);

// Order these so they respect foreign key constraints
export default [
  contactDrier, // A lot of relations depend on contacts so leave it first
  contactRoleDrier,
  contacrProfileDrier,
  emailDrier,
  emailMailingDrier,
  exportsDrier,
  giftFlowDrier,
  noticesDrier,
  optionsDrier,
  paymentDataDrier,
  paymentsDrier,
  pageSettingsDrier,
  calloutsDrier, // Must be before calloutResponsesDrier
  calloutResponsesDrier,
  projectsDrier,
  projectContactsDrier,
  projectEngagmentsDrier,
  referralsGiftDrier, // Must be before referralsDrier
  referralsDrier,
  segmentsDrier,
  segmentContactsDrier,
  segmentOngoingEmailsDrier,
  exportItemsDrier // Must be after all exportable items
] as ModelDrier<any>[];

function isDrier<T>(obj: DrierMap<T>[keyof T]): obj is Drier<T[keyof T]> {
  return typeof obj === "object" && "propMap" in obj;
}

// Maps don't stringify well
function stringify(value: any): string {
  return JSON.stringify(value, (key: string, value: any): any => {
    return value instanceof Map ? [...value] : value;
  });
}

function runDrier<T>(
  item: T,
  drier: Drier<T>,
  valueMap: Map<string, unknown>
): T {
  const newItem = Object.assign({}, item);

  for (const _prop of Object.keys(drier.propMap)) {
    const prop = _prop as keyof T;
    const propMap = drier.propMap[prop];
    const oldValue = item[prop];
    if (oldValue && propMap) {
      const valueKey = stringify(oldValue);

      const newValue = isDrier(propMap)
        ? runDrier(oldValue, propMap, valueMap)
        : valueMap.get(valueKey) || propMap(oldValue);

      valueMap.set(valueKey, newValue);
      newItem[prop] = newValue as ({} & T)[keyof T];
    }
  }

  return newItem;
}

export async function runExport<T>(
  drier: ModelDrier<T>,
  fn: (qb: SelectQueryBuilder<T>) => SelectQueryBuilder<T>,
  valueMap: Map<string, unknown>
): Promise<void> {
  const metadata = getRepository(drier.model).metadata;
  log.info(`Anonymising ${metadata.tableName}`);

  const orderBy: OrderByCondition = Object.fromEntries(
    metadata.primaryColumns.map((col) => ["item." + col.databaseName, "ASC"])
  );

  for (let i = 0; ; i += 1000) {
    const items = await fn(createQueryBuilder(drier.model, "item"))
      .loadAllRelationIds()
      .orderBy(orderBy)
      .offset(i)
      .limit(1000)
      .getMany();

    if (items.length === 0) {
      break;
    }

    const newItems = items.map((item) => runDrier(item, drier, valueMap));

    const [query, params] = createQueryBuilder()
      .insert()
      .into(drier.model)
      .values(newItems as QueryDeepPartialEntity<T>)
      .getQueryAndParameters();

    console.log(query + ";");
    console.log(stringify(params));
  }
}

const componentMapper = {
  textarea: () => () => chance.paragraph(),
  textfield: () => () => chance.sentence(),
  select: (component) => () => chance.pickone(component.data.values),
  number: () => () => chance.integer(),
  password: () => () => chance.word(),
  button: () => (v) => v,
  radio: () => (v) => v,
  selectboxes: () => (v) => v,
  checkbox: () => (v) => v
} as const satisfies Record<
  CalloutComponentSchema["type"],
  (
    component: CalloutComponentSchema
  ) => (v: CalloutResponseAnswer) => CalloutResponseAnswer
>;

function createAnswersDrier(callout: Callout): Drier<CalloutResponseAnswers> {
  const propMap = Object.fromEntries(
    flattenComponents(callout.formSchema.components).map((component) => [
      component.key,
      componentMapper[component.type](component)
    ])
  );

  return { propMap };
}

export async function runExportCalloutResponses(
  fn: (
    qb: SelectQueryBuilder<CalloutResponse>
  ) => SelectQueryBuilder<CalloutResponse>,
  valueMap: Map<string, unknown>
): Promise<void> {
  log.info("Anonymising callout responses");

  const callouts = await createQueryBuilder(Callout, "callout").getMany();
  for (const callout of callouts) {
    const answersDrier = createAnswersDrier(callout);

    const responses = await fn(createQueryBuilder(CalloutResponse, "response"))
      .loadAllRelationIds()
      .where("response.callout = :callout", { callout })
      .orderBy("id", "ASC")
      .getMany();

    const newResponses = responses.map((response) => {
      const newResponse = runDrier(response, calloutResponsesDrier, valueMap);
      newResponse.answers = runDrier(response.answers, answersDrier, valueMap);
    });

    const [query, params] = createQueryBuilder()
      .insert()
      .into(CalloutResponse)
      .values(newResponses as QueryDeepPartialEntity<CalloutResponse>)
      .getQueryAndParameters();

    console.log(query + ";");
    console.log(stringify(params));
  }
}

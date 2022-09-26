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
import Member from "@models/Member";
import MemberPermission from "@models/MemberPermission";
import MemberProfile from "@models/MemberProfile";
import Notice from "@models/Notice";
import Option from "@models/Option";
import PageSettings from "@models/PageSettings";
import Payment from "@models/Payment";
import PaymentData from "@models/PaymentData";
import Poll from "@models/Poll";
import PollResponse from "@models/PollResponse";
import Project from "@models/Project";
import ProjectMember from "@models/ProjectMember";
import ProjectEngagement from "@models/ProjectEngagement";
import Referral from "@models/Referral";
import ReferralGift from "@models/ReferralGift";
import Segment from "@models/Segment";
import SegmentMember from "@models/SegmentMember";
import SegmentOngoingEmail from "@models/SegmentOngoingEmail";

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
const memberId = () => uuidv4() as unknown as Member;

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
  member: memberId
});

export const paymentDataDrier = createModelDrier(PaymentData, {
  member: memberId,
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
  giftee: memberId
});

export const memberDrier = createModelDrier(Member, {
  id: () => uuidv4(),
  email: () => chance.email({ domain: "fake.beabee.io", length: 10 }),
  firstname: () => chance.first(),
  lastname: () => chance.last(),
  otp: () => ({ activated: false, key: null }),
  password: () => ({ hash: "", salt: "", iterations: 0, tries: 0 }),
  pollsCode: uniqueCode,
  referralCode: uniqueCode
});

export const memberPermissionDrier = createModelDrier(MemberPermission, {
  member: memberId
});

export const memberProfileDrier = createModelDrier(MemberProfile, {
  member: memberId,
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

export const pollsDrier = createModelDrier(Poll);

export const pollResponsesDrier = createModelDrier(PollResponse, {
  id: () => uuidv4(),
  member: memberId,
  guestName: () => chance.name(),
  guestEmail: () => chance.email({ domain: "example.com", length: 10 })
});

const projectsDrier = createModelDrier(Project, {
  owner: memberId
});

const projectMembersDrier = createModelDrier(ProjectMember, {
  id: () => uuidv4(),
  member: memberId,
  tag: () => chance.profession()
});

const projectEngagmentsDrier = createModelDrier(ProjectEngagement, {
  id: () => uuidv4(),
  byMember: memberId,
  toMember: memberId,
  notes: () => chance.sentence()
});

const referralsDrier = createModelDrier(Referral, {
  id: () => uuidv4(),
  referrer: memberId,
  referee: memberId
});

const referralsGiftDrier = createModelDrier(ReferralGift, {
  stock: copy // Add to map so it is serialised correctly
});

const segmentsDrier = createModelDrier(Segment);

const segmentMembersDrier = createModelDrier(SegmentMember, {
  member: memberId
});

const segmentOngoingEmailsDrier = createModelDrier(SegmentOngoingEmail);

// Order these so they respect foreign key constraints
export default [
  memberDrier, // A lot of relations depend on members so leave it first
  memberPermissionDrier,
  memberProfileDrier,
  emailDrier,
  emailMailingDrier,
  exportsDrier,
  giftFlowDrier,
  noticesDrier,
  optionsDrier,
  paymentDataDrier,
  paymentsDrier,
  pageSettingsDrier,
  pollsDrier, // Must be before pollResponsesDrier
  pollResponsesDrier,
  projectsDrier,
  projectMembersDrier,
  projectEngagmentsDrier,
  referralsGiftDrier, // Must be before referralsDrier
  referralsDrier,
  segmentsDrier,
  segmentMembersDrier,
  segmentOngoingEmailsDrier,
  exportItemsDrier // Must be after all exportable items
] as ModelDrier<any>[];

function isDrier<T>(obj: DrierMap<T>[keyof T]): obj is Drier<T[keyof T]> {
  return obj && "propMap" in obj;
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

import crypto from "crypto";
import {
  createQueryBuilder,
  EntityTarget,
  getRepository,
  OrderByCondition,
  SelectQueryBuilder
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { Chance } from "chance";

import Email from "@models/Email";
import EmailMailing from "@models/EmailMailing";
import Export from "@models/Export";
import ExportItem from "@models/ExportItem";
import GiftFlow, { GiftForm } from "@models/GiftFlow";
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

type DrierMap<T> = { [K in keyof T]?: ((prop: T[K]) => T[K]) | Drier<T[K]> };

export interface Drier<T> {
  model: EntityTarget<T>;
  propMap: DrierMap<T>;
}

function createDrier<T>(
  model: EntityTarget<T>,
  propMap: DrierMap<T> = {}
): Drier<T> {
  return { model, propMap };
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

const emailDrier = createDrier(Email);

const emailMailingDrier = createDrier(EmailMailing, {
  recipients: () => []
});

const exportsDrier = createDrier(Export);

const exportItemsDrier = createDrier(ExportItem, {
  itemId: copy // These will be mapped to values that have already been seen
});

export const paymentsDrier = createDrier(Payment, {
  id: () => uuidv4(),
  subscriptionId: randomId(12, "SB"),
  member: memberId
});

export const paymentDataDrier = createDrier(PaymentData, {
  member: memberId,
  data: (data) => ({
    ...data,
    ...("customerId" in data && { customerId: randomId(12, "CU")() }),
    ...("mandateId" in data && { customerId: randomId(12, "MD")() }),
    ...("subscriptionId" in data && { customerId: randomId(12, "SB")() }),
    ...("source" in data && {
      source: chance.pickone(["Direct Debit", "PayPal", "Other"])
    }),
    ...("reference" in data && { reference: chance.word() })
  })
});

const giftFlowDrier = createDrier(GiftFlow, {
  id: () => uuidv4(),
  setupCode: uniqueCode,
  sessionId: randomId(12),
  giftForm: createDrier(GiftForm, {
    firstname: () => chance.first(),
    lastname: () => chance.last(),
    email: () => chance.email({ domain: "fake.beabee.io", length: 10 }),
    message: () => chance.sentence(),
    fromName: () => chance.name(),
    fromEmail: () => chance.email({ domain: "fake.beabee.io", length: 10 })
  }),
  giftee: memberId
});

export const memberDrier = createDrier(Member, {
  id: () => uuidv4(),
  email: () => chance.email({ domain: "fake.beabee.io", length: 10 }),
  firstname: () => chance.first(),
  lastname: () => chance.last(),
  otp: () => ({ activated: false, key: null }),
  password: () => ({ hash: "", salt: "", iterations: 0, tries: 0 }),
  pollsCode: uniqueCode,
  referralCode: uniqueCode
});

export const memberPermissionDrier = createDrier(MemberPermission, {
  member: memberId
});

export const memberProfileDrier = createDrier(MemberProfile, {
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

const noticesDrier = createDrier(Notice);

const optionsDrier = createDrier(Option);

const pageSettingsDrier = createDrier(PageSettings);

export const pollsDrier = createDrier(Poll);

export const pollResponsesDrier = createDrier(PollResponse, {
  id: () => uuidv4(),
  member: memberId,
  guestName: () => chance.name(),
  guestEmail: () => chance.email({ domain: "example.com", length: 10 })
});

const projectsDrier = createDrier(Project, {
  owner: memberId
});

const projectMembersDrier = createDrier(ProjectMember, {
  id: () => uuidv4(),
  member: memberId,
  tag: () => chance.profession()
});

const projectEngagmentsDrier = createDrier(ProjectEngagement, {
  id: () => uuidv4(),
  byMember: memberId,
  toMember: memberId,
  notes: () => chance.sentence()
});

const referralsDrier = createDrier(Referral, {
  id: () => uuidv4(),
  referrer: memberId,
  referee: memberId
});

const referralsGiftDrier = createDrier(ReferralGift, {
  stock: copy // Add to map so it is serialised correctly
});

const segmentsDrier = createDrier(Segment);

const segmentMembersDrier = createDrier(SegmentMember, {
  member: memberId
});

const segmentOngoingEmailsDrier = createDrier(SegmentOngoingEmail);

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
] as Drier<any>[];

function isDrier<T>(
  propMap: DrierMap<T>[keyof T]
): propMap is Drier<T[keyof T]> {
  return "propMap" in propMap;
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
      newItem[prop] = newValue as T[keyof T];
    }
  }

  return newItem;
}

export async function runExport<T>(
  drier: Drier<T>,
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
      .values(newItems)
      .getQueryAndParameters();

    console.log(query + ";");
    console.log(stringify(params));
  }
}

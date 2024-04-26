import {
  ContributionPeriod,
  PaymentMethod,
  StripeFeeCountry
} from "@beabee/beabee-common";

import { Locale } from "@locale";
import { ContentId } from "./content-id";

interface FooterLink {
  url: string;
  text: string;
}

export interface ContentContactsData {
  tags: string[];
  manualPaymentSources: string[];
}

export interface ContentEmailData {
  supportEmail: string;
  supportEmailName: string;
  footer: string;
}

export interface ContentGeneralData {
  organisationName: string;
  logoUrl: string;
  siteUrl: string;
  supportEmail: string;
  privacyLink: string;
  termsLink: string;
  impressumLink: string;
  locale: Locale;
  theme: object;
  currencyCode: string;
  currencySymbol: string;
  backgroundUrl: string;
  hideContribution: boolean;
  footerLinks: FooterLink[];
}

export interface ContentJoinPeriodData {
  name: ContributionPeriod;
  presetAmounts: number[];
}

export interface ContentJoinData {
  title: string;
  subtitle: string;
  initialAmount: number;
  initialPeriod: ContributionPeriod;
  minMonthlyAmount: number;
  periods: ContentJoinPeriodData[];
  showAbsorbFee: boolean;
  showNoContribution: boolean;
  paymentMethods: PaymentMethod[];
  /** @deprecated Use {@link ContentPaymentData.stripePublicKey} instead. */
  stripePublicKey: string;
  /** @deprecated Use {@link ContentPaymentData.stripeCountry} instead. */
  stripeCountry: StripeFeeCountry;
}

export interface ContentJoinSetupData {
  welcome: string;
  newsletterText: string;
  newsletterOptIn: string;
  newsletterTitle: string;
  showNewsletterOptIn: boolean;
  showMailOptIn: boolean;
  mailTitle: string;
  mailText: string;
  mailOptIn: string;
  surveySlug: string;
  surveyRequired: boolean;
  surveyText: string;
}

export interface ContentProfileData {
  introMessage: string;
}

export interface ContentShareData {
  title: string;
  description: string;
  image: string;
  twitterHandle: string;
}

export interface ContentPaymentData {
  stripePublicKey: string;
  stripeCountry: StripeFeeCountry;
  stripeTaxRateId: string;
  taxRateEnabled: boolean;
  taxRate: number;
}

export type ContentData<Id extends ContentId = ContentId> =
  Id extends "contacts"
    ? ContentContactsData
    : never | Id extends "email"
      ? ContentEmailData
      : never | Id extends "general"
        ? ContentGeneralData
        : never | Id extends "join"
          ? ContentJoinData
          : never | Id extends "join/setup"
            ? ContentJoinSetupData
            : never | Id extends "profile"
              ? ContentProfileData
              : never | Id extends "share"
                ? ContentShareData
                : never | Id extends "payment"
                  ? ContentPaymentData
                  : never;

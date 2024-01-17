import { Locale } from "@locale";
import { ContentId } from "./content-id";

interface FooterLink {
  url: string;
  text: string;
}

export interface ContactsContentData {
  tags: string[];

  manualPaymentSources: string[];
}

export interface EmailContentData {
  supportEmail: string;

  supportEmailName: string;

  footer: string;
}

export interface GeneralContentData {
  organisationName: string;

  logoUrl: string;

  siteUrl: string;

  supportEmail: string;

  privacyLink: string;

  termsLink: string;

  impressumLink: string;

  locale: Locale;

  theme: object;

  backgroundUrl: string;

  currencyCode: string;

  currencySymbol: string;

  hideContribution?: boolean;

  footerLinks?: FooterLink[];
}

export interface JoinContentData {
  minMonthlyAmount: number;

  showAbsorbFee: boolean;

  stripePublicKey: string;

  stripeCountry: string;
}

export interface JoinSetupContentData {
  showMailOptIn: boolean;

  surveySlug: string;
}

export interface ProfileContentData {
  introMessage: string;
}

export interface ShareContentData {
  title: string;

  description: string;

  image: string;

  twitterHandle: string;
}

export type ContentData<Id extends ContentId = ContentId> =
  Id extends "contacts"
    ? ContactsContentData
    : never | Id extends "email"
      ? EmailContentData
      : never | Id extends "general"
        ? GeneralContentData
        : never | Id extends "join"
          ? JoinContentData
          : never | Id extends "join/setup"
            ? JoinSetupContentData
            : never | Id extends "profile"
              ? ProfileContentData
              : never | Id extends "share"
                ? ShareContentData
                : never;

import {
  ContributionPeriod,
  PaymentMethod,
  StripeFeeCountry
} from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsString,
  ValidateNested
} from "class-validator";

import { LinkDto } from "@api/dto/LinkDto";

import { Locale } from "@locale";

import {
  ContactsContentData,
  EmailContentData,
  GeneralContentData,
  JoinContentData,
  JoinContentPeriodData,
  JoinSetupContentData,
  ProfileContentData,
  ShareContentData
} from "@type/content-data";
import { ContentId } from "@type/content-id";

export class GetContactsContentDto implements ContactsContentData {
  @IsString({ each: true })
  tags!: string[];

  @IsString({ each: true })
  manualPaymentSources!: string[];
}

export class GetEmailContentDto implements EmailContentData {
  @IsString()
  supportEmail!: string;

  @IsString()
  supportEmailName!: string;

  @IsString()
  footer!: string;
}

export class GetGeneralContentDto implements GeneralContentData {
  @IsString()
  organisationName!: string;

  @IsString()
  logoUrl!: string;

  @IsString()
  siteUrl!: string;

  @IsString()
  supportEmail!: string;

  @IsString()
  privacyLink!: string;

  @IsString()
  termsLink!: string;

  @IsString()
  impressumLink!: string;

  @IsString()
  locale!: Locale;

  @IsObject() // TODO: validate properly
  theme!: object;

  @IsString()
  currencyCode!: string;

  @IsString()
  currencySymbol!: string;

  @IsString()
  backgroundUrl!: string;

  @IsBoolean()
  hideContribution!: boolean;

  @ValidateNested({ each: true })
  @Type(() => LinkDto)
  footerLinks!: LinkDto[];
}

class GetJoinContentPeriodDto implements JoinContentPeriodData {
  @IsEnum(ContributionPeriod)
  name!: ContributionPeriod;

  @IsNumber({}, { each: true })
  presetAmounts!: number[];
}

export class GetJoinContentDto implements JoinContentData {
  @IsString()
  title!: string;

  @IsString()
  subTitle!: string;

  @IsNumber()
  initialAmount!: number;

  @IsEnum(ContributionPeriod)
  initialPeriod!: ContributionPeriod;

  @ValidateNested({ each: true })
  @Type(() => GetJoinContentPeriodDto)
  periods!: GetJoinContentPeriodDto[];

  @IsBoolean()
  showNoContribution!: boolean;

  @IsEnum(PaymentMethod, { each: true })
  paymentMethods!: PaymentMethod[];

  @IsNumber()
  minMonthlyAmount!: number;

  @IsBoolean()
  showAbsorbFee!: boolean;

  @IsString()
  stripePublicKey!: string;

  @IsIn(["eu", "gb", "ca"])
  stripeCountry!: StripeFeeCountry;
}

export class GetJoinSetupContentDto implements JoinSetupContentData {
  @IsString()
  welcome!: string;

  @IsString()
  newsletterText!: string;

  @IsString()
  newsletterOptIn!: string;

  @IsString()
  newsletterTitle!: string;

  @IsBoolean()
  showNewsletterOptIn!: boolean;

  @IsString()
  mailTitle!: string;

  @IsString()
  mailText!: string;

  @IsString()
  mailOptIn!: string;

  @IsBoolean()
  surveyRequired!: boolean;

  @IsString()
  surveyText!: string;

  @IsBoolean()
  showMailOptIn!: boolean;

  @IsString()
  surveySlug!: string;
}

export class GetProfileContentDto implements ProfileContentData {
  @IsString()
  introMessage!: string;
}

export class GetShareContentDto implements ShareContentData {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  image!: string;

  @IsString()
  twitterHandle!: string;
}

export type GetContentDto<Id extends ContentId = ContentId> =
  Id extends "contacts"
    ? GetContactsContentDto
    : never | Id extends "email"
      ? GetEmailContentDto
      : never | Id extends "general"
        ? GetGeneralContentDto
        : never | Id extends "join"
          ? GetJoinContentDto
          : never | Id extends "join/setup"
            ? GetJoinSetupContentDto
            : never | Id extends "profile"
              ? GetProfileContentDto
              : never | Id extends "share"
                ? GetShareContentDto
                : never;

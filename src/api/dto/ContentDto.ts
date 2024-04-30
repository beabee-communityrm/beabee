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
import { GetContentTelegramDto } from "@api/dto/ContentTelegramDto";

import { Locale } from "@locale";

import {
  ContentContactsData,
  ContentEmailData,
  ContentGeneralData,
  ContentJoinData,
  ContentJoinPeriodData,
  ContentJoinSetupData,
  ContentProfileData,
  ContentShareData,
  ContentPaymentData
} from "@type/content-data";
import { ContentId } from "@type/content-id";

export class GetContentContactsDto implements ContentContactsData {
  @IsString({ each: true })
  tags!: string[];

  @IsString({ each: true })
  manualPaymentSources!: string[];
}

export class GetContentEmailDto implements ContentEmailData {
  @IsString()
  supportEmail!: string;

  @IsString()
  supportEmailName!: string;

  @IsString()
  footer!: string;
}

export class GetContentGeneralDto implements ContentGeneralData {
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

class GetContentJoinPeriodDto implements ContentJoinPeriodData {
  @IsEnum(ContributionPeriod)
  name!: ContributionPeriod;

  @IsNumber({}, { each: true })
  presetAmounts!: number[];
}

export class GetContentJoinDto implements ContentJoinData {
  @IsString()
  title!: string;

  @IsString()
  subtitle!: string;

  @IsNumber()
  initialAmount!: number;

  @IsEnum(ContributionPeriod)
  initialPeriod!: ContributionPeriod;

  @ValidateNested({ each: true })
  @Type(() => GetContentJoinPeriodDto)
  periods!: GetContentJoinPeriodDto[];

  @IsBoolean()
  showNoContribution!: boolean;

  @IsEnum(PaymentMethod, { each: true })
  paymentMethods!: PaymentMethod[];

  @IsNumber()
  minMonthlyAmount!: number;

  @IsBoolean()
  showAbsorbFee!: boolean;

  /** @deprecated Use {@link GetContentPaymentDto.stripePublicKey} instead. */
  @IsString()
  stripePublicKey!: string;

  /** @deprecated Use {@link GetContentPaymentDto.stripeCountry} instead. */
  @IsIn(["eu", "gb", "ca"])
  stripeCountry!: StripeFeeCountry;
}

export class GetContentJoinSetupDto implements ContentJoinSetupData {
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

export class GetContentProfileDto implements ContentProfileData {
  @IsString()
  introMessage!: string;
}

export class GetContentShareDto implements ContentShareData {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  image!: string;

  @IsString()
  twitterHandle!: string;
}

export class GetContentPaymentDto implements ContentPaymentData {
  @IsString()
  stripePublicKey!: string;

  @IsIn(["eu", "gb", "ca"])
  stripeCountry!: StripeFeeCountry;

  @IsBoolean()
  taxRateEnabled!: boolean;

  @IsNumber()
  taxRate!: number;
}

export type GetContentDto<Id extends ContentId = ContentId> =
  Id extends "contacts"
    ? GetContentContactsDto
    : never | Id extends "email"
      ? GetContentEmailDto
      : never | Id extends "general"
        ? GetContentGeneralDto
        : never | Id extends "join"
          ? GetContentJoinDto
          : never | Id extends "join/setup"
            ? GetContentJoinSetupDto
            : never | Id extends "profile"
              ? GetContentProfileDto
              : never | Id extends "share"
                ? GetContentShareDto
                : never | Id extends "payment"
                  ? GetContentPaymentDto
                  : never | Id extends "telegram"
                    ? GetContentTelegramDto
                    : never;

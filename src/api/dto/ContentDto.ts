import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
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
  backgroundUrl!: string;

  @IsString()
  currencyCode!: string;

  @IsString()
  currencySymbol!: string;

  @IsOptional()
  @IsBoolean()
  hideContribution?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LinkDto)
  footerLinks?: LinkDto[];
}

export class GetJoinContentDto implements JoinContentData {
  @IsNumber()
  minMonthlyAmount!: number;

  @IsBoolean()
  showAbsorbFee!: boolean;

  @IsString()
  stripePublicKey!: string;

  @IsString()
  stripeCountry!: string;
}

export class GetJoinSetupContentDto implements JoinSetupContentData {
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

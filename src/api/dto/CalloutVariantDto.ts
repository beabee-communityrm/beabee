import {
  CalloutVariantData,
  CalloutVariantNavigationData
} from "@beabee/beabee-common";
import { IsString, IsOptional, IsUrl, IsObject } from "class-validator";

export class CalloutVariantDto implements CalloutVariantData {
  @IsString()
  title!: string;

  @IsString()
  excerpt!: string;

  @IsString()
  intro!: string;

  @IsString()
  thanksTitle!: string;

  @IsString()
  thanksText!: string;

  @IsOptional()
  @IsUrl()
  thanksRedirect!: string | null;

  @IsOptional()
  @IsString()
  shareTitle!: string | null;

  @IsOptional()
  @IsString()
  shareDescription!: string | null;

  @IsObject() // TODO
  slideNavigation!: Record<string, CalloutVariantNavigationData>;

  @IsObject() // TODO
  componentText!: Record<string, string>;
}

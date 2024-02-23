import { CalloutVariantData } from "@type/callout-variant-data";
import { IsString, IsOptional, IsUrl } from "class-validator";

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
}

import { IsString, IsOptional, IsUrl } from "class-validator";

export class CalloutVariantDto {
  @IsString()
  locale!: string;

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
  thanksRedirect?: string;

  @IsOptional()
  @IsString()
  shareTitle?: string;

  @IsOptional()
  @IsString()
  shareDescription?: string;
}

import { CalloutVariantDto } from "@api/dto/CalloutVariantDto";
import CalloutVariant from "@models/CalloutVariant";
import { TransformPlainToInstance } from "class-transformer";
import { BaseTransformer } from "./BaseTransformer";

class CalloutVariantTransformer extends BaseTransformer<
  CalloutVariant,
  CalloutVariantDto
> {
  protected model = CalloutVariant;
  protected filters = {};

  @TransformPlainToInstance(CalloutVariantDto)
  convert(variant: CalloutVariant): CalloutVariantDto {
    return {
      locale: variant.locale,
      title: variant.title,
      excerpt: variant.excerpt,
      intro: variant.intro,
      thanksTitle: variant.thanksTitle,
      thanksText: variant.thanksText,
      ...(variant.thanksRedirect && { thanksRedirect: variant.thanksRedirect }),
      ...(variant.shareTitle && { shareTitle: variant.shareTitle }),
      ...(variant.shareDescription && {
        shareDescription: variant.shareDescription
      })
    };
  }
}

export default new CalloutVariantTransformer();

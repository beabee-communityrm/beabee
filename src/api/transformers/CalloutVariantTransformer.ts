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
      title: variant.title,
      excerpt: variant.excerpt,
      intro: variant.intro,
      thanksTitle: variant.thanksTitle,
      thanksText: variant.thanksText,
      thanksRedirect: variant.thanksRedirect,
      shareTitle: variant.shareTitle,
      shareDescription: variant.shareDescription,
      slideNavigation: variant.slideNavigation,
      componentText: variant.componentText
    };
  }
}

export default new CalloutVariantTransformer();

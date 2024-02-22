import { CalloutVariantData } from "./callout-variant-data";

export interface CalloutVariantsData {
  default: CalloutVariantData;
  [locale: string]: CalloutVariantData;
}

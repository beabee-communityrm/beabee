import {
  CalloutNavigationSchema,
  CalloutSlideSchema
} from "@beabee/beabee-common";
import { CalloutVariantNavigationData } from "./callout-variant-data";

export interface CalloutFormData {
  slides: CalloutSlideData[];
}

export interface CalloutSlideData
  extends Omit<CalloutSlideSchema, "navigation"> {
  navigation: CalloutSlideNavigationData;
}

export type CalloutSlideNavigationData = Omit<
  CalloutNavigationSchema,
  keyof CalloutVariantNavigationData
>;
